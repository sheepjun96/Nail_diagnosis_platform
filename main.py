"""Public API process. Models and inference dependencies live in ai_service.py."""
from contextlib import AsyncExitStack, asynccontextmanager
import logging
import os
import time
import uuid

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from auth import APP_HOME_PATH, close_auth_resources, init_auth_resources, require_login
from config import PROJECT_ROOT, settings
from db import close_db, init_db, transaction
from services.ai_client import create_ai_client
from services.cache import close_cache, init_cache

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("nail.api")


@asynccontextmanager
async def lifespan(application):
    from config import ensure_directories
    ensure_directories()
    async with AsyncExitStack() as resources:
        await init_db(application)
        resources.push_async_callback(close_db, application)
        await init_cache(application)
        resources.push_async_callback(close_cache, application)
        resources.push_async_callback(close_auth_resources, application)
        await init_auth_resources(application)
        application.state.ai_client = await resources.enter_async_context(create_ai_client())
        yield


enable_docs = os.getenv("NAIL_ENABLE_DOCS", "false").lower() == "true"
app = FastAPI(
    title="Curaxel Nail Platform API", version="0.2.0", lifespan=lifespan,
    docs_url="/docs" if enable_docs else None, redoc_url=None,
    openapi_url="/openapi.json" if enable_docs else None,
)
origins = settings.value("server", "cors_origins", [])
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Upload-Token"])


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = uuid.uuid4().hex
    started = time.monotonic()
    # Cookie-authenticated writes must originate from this application.
    origin = request.headers.get("origin")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and origin:
        permitted = set(origins)
        permitted.add(str(request.base_url).rstrip("/"))
        public_url = os.getenv("NAIL_PUBLIC_BASE_URL", "").rstrip("/")
        if public_url:
            permitted.add(public_url)
        if origin not in permitted:
            return JSONResponse({"detail": "Cross-origin write request denied."}, status_code=403)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    if request.url.path.startswith(("/api/", "/images/")):
        response.headers["Cache-Control"] = "private, no-store"
    # Do not log query strings, SSO tickets, credentials or patient payloads.
    logger.info("%s %s status=%s duration=%.3fs request_id=%s", request.method,
                request.url.path, response.status_code, time.monotonic() - started, request_id)
    return response


@app.get("/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
@app.get("/api/health", include_in_schema=False)
async def ready(request: Request):
    checks = {}
    try:
        async with transaction(request.app.state.db_pool) as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT 1")
                await cursor.fetchone()
        checks["db"] = "ok"
        await request.app.state.redis.ping()
        checks["redis"] = "ok"
        response = await request.app.state.ai_client.get("/health/ready", timeout=3)
        response.raise_for_status()
        checks["ai"] = "ok"
    except Exception:
        logger.warning("Readiness check failed", exc_info=True)
        return JSONResponse({"status": "unavailable", "checks": checks}, status_code=503)
    from auth import _auth_is_configured
    checks["sso"] = "configured" if _auth_is_configured() else "not_configured"
    return {"status": "ready", "checks": checks}


from router.api_auth import router as auth_router
from router.api_private import router as resource_router
from router.api_public import router as upload_router
from router.api_ai import router as ai_router

app.include_router(auth_router)
app.include_router(resource_router, dependencies=[Depends(require_login)])
app.include_router(upload_router)
app.include_router(ai_router, dependencies=[Depends(require_login)])


@app.get("/api/config/models", dependencies=[Depends(require_login)])
async def model_metadata():
    from services.fingers import LAYOUTS
    return {"classes": settings.classifier["class_names"], "capture_types": ["auto", *LAYOUTS]}


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(APP_HOME_PATH, status_code=302)


@app.get("/app", include_in_schema=False)
@app.get("/app/{path:path}", include_in_schema=False)
async def legacy_page(request: Request, path: str = ""):
    target = APP_HOME_PATH + ("/" + path if path else "")
    if request.url.query:
        target += "?" + request.url.query
    return RedirectResponse(target, status_code=308)


@app.get("/images/{path:path}", dependencies=[Depends(require_login)], include_in_schema=False)
async def legacy_image(request: Request, path: str):
    # Preserve old image links while applying authentication and safe path checks.
    from fastapi.responses import FileResponse
    from services.storage import shared_image_path
    from auth import ensure_role
    from router.models.resource import WORKLIST_VIEW_ROLES
    ensure_role(request.state.member, WORKLIST_VIEW_ROLES, "view image")
    return FileResponse(shared_image_path(path), headers={"Cache-Control": "private, no-store"})


@app.api_route("/send_patient_data", methods=["POST"], include_in_schema=False)
@app.api_route("/viewer/{pid}/{appt_date}", methods=["GET"], include_in_schema=False)
@app.api_route("/upload-hand-image/{pid}/{appt_date}", methods=["POST"], include_in_schema=False)
async def retired_emr(pid: str = "", appt_date: str = ""):
    raise HTTPException(410, "The legacy OpenEMR/JSON integration is retired. Use the authenticated resource API.")


# Expose only application assets, never static/patient_images.
for directory in ("bootstrap",):
    asset_dir = PROJECT_ROOT / "static" / directory
    if asset_dir.is_dir():
        app.mount(f"/static/{directory}", StaticFiles(directory=asset_dir), name=directory)
