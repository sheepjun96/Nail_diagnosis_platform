"""Private inference microservice. No patient database or SSO credentials needed."""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import hmac
import io
import json
import logging
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field

from config import CONFIG_DIR, ensure_directories, settings
from services.cache import close_cache, init_cache
from services.fingers import FINGER_CODES, LAYOUTS
from services.storage import shared_image_path

logger = logging.getLogger(__name__)


def load_models():
    import torch
    from utils.lesion_predict import LesionPredict
    from utils.nail_detect import NailDetect
    settings.validate_models()
    torch.set_num_threads(int(os.getenv("NAIL_TORCH_THREADS", "4")))
    predictor = LesionPredict()
    device = 0 if predictor.device.type == "cuda" else "cpu"
    return NailDetect(device=device), predictor


@asynccontextmanager
async def lifespan(application):
    if not os.getenv("NAIL_INTERNAL_API_TOKEN"):
        raise RuntimeError("NAIL_INTERNAL_API_TOKEN must be configured.")
    ensure_directories()
    try:
        await init_cache(application)
        application.state.detector, application.state.predictor = await asyncio.to_thread(load_models)
        application.state.gate = asyncio.Semaphore(1)
        logger.info("AI models ready; classes=%s", settings.classifier["class_names"])
        yield
    finally:
        await close_cache(application)


app = FastAPI(title="Nail Inference Service", lifespan=lifespan, docs_url=None, redoc_url=None)


async def internal_access(authorization: str = Header(default="")):
    expected = os.getenv("NAIL_INTERNAL_API_TOKEN", "")
    if not expected or not hmac.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(401, "Internal service authentication required.")


class ImageRequest(BaseModel):
    image_path: str = Field(min_length=1, max_length=1024)
    capture_type: str = "auto"


class PlotRequest(ImageRequest):
    crop_info: list[float] = Field(min_length=4, max_length=4)


@app.get("/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
async def ready():
    return {"status": "ready", "classes": settings.classifier["class_names"]}


async def predict_cached(path):
    predictor = app.state.predictor
    digest = await asyncio.to_thread(lambda: hashlib.sha256(Path(path).read_bytes()).hexdigest())
    key = f"nail:prediction:{predictor.version}:{digest}"
    cached = await app.state.redis.get(key)
    if cached:
        return json.loads(cached)
    def predict():
        with Image.open(path) as image:
            return predictor.predict(image)
    result = await asyncio.to_thread(predict)
    await app.state.redis.set(key, json.dumps(result), ex=int(settings.value("ai", "cache_ttl_seconds", 86400)))
    return result


def draw_plot(path, coords=None):
    with Image.open(path) as source:
        image = source.convert("RGB")
    drawing = ImageDraw.Draw(image)
    if coords is not None:
        x1, y1, x2, y2 = coords
        if not (0 <= x1 < x2 <= image.width and 0 <= y1 < y2 <= image.height):
            raise HTTPException(422, "Invalid crop coordinates.")
        drawing.rectangle(coords, outline="red", width=3)
    else:
        x1, y1, x2, y2 = 0, 0, image.width, image.height
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    drawing.line((cx, y1, cx, y2), fill="black", width=1)
    drawing.line((x1, cy, x2, cy), fill="black", width=1)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@app.post("/v1/predict", dependencies=[Depends(internal_access)])
async def predict(body: ImageRequest):
    path = shared_image_path(body.image_path)
    async with app.state.gate:
        return await predict_cached(path)


@app.post("/v1/detect", dependencies=[Depends(internal_access)])
async def detect(body: ImageRequest):
    path = shared_image_path(body.image_path)
    if body.capture_type not in {"auto", *LAYOUTS}:
        raise HTTPException(422, "Unsupported capture_type.")
    async with app.state.gate:
        results = await asyncio.to_thread(
            app.state.detector.detect_and_crop, path, CONFIG_DIR["crop"], body.capture_type,
        )
    return {"results": results}


@app.post("/v1/plot", dependencies=[Depends(internal_access)])
async def plot(body: PlotRequest):
    path = shared_image_path(body.image_path)
    return Response(await asyncio.to_thread(draw_plot, path, body.crop_info), media_type="image/png")


@app.post("/v1/analyze", dependencies=[Depends(internal_access)])
async def analyze(body: ImageRequest):
    path = shared_image_path(body.image_path)
    if body.capture_type not in {"auto", *LAYOUTS}:
        raise HTTPException(422, "Unsupported capture_type.")
    created = []
    async with app.state.gate:
        try:
            results = await asyncio.to_thread(
                app.state.detector.detect_and_crop, path, CONFIG_DIR["crop"], body.capture_type,
            )
            created.extend(Path(item["cropped_nail_path"]) for item in results)
            for item in results:
                crop = Path(item["cropped_nail_path"])
                item["ai_result"] = await predict_cached(crop)
                item["finger_code"] = FINGER_CODES.get(item["finger_name"], "unknown")
                extra = Path(CONFIG_DIR["extra"]) / f"plot_{crop.name}"
                extra.write_bytes(await asyncio.to_thread(draw_plot, crop))
                created.append(extra)
                item["plot_path"] = extra.as_posix()
            return {"results": results, "warnings": (
                ["Finger assignment requires review. Specify capture_type for single-hand or partial captures."]
                if any(not item["assignment_complete"] for item in results) else []
            )}
        except BaseException:
            for target in created:
                target.unlink(missing_ok=True)
            raise
