# api_public.py
import os
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from config import CONFIG_DIR

router = APIRouter(prefix="/api", tags=["api-private"])
SAVE_NAIL_DIR = CONFIG_DIR["nail"]

from router.models.member import router as member_api
from router.models.resource import router as resource_api
from router.models.resource_viewer import router as resource_viewer_api 

# Member : list(add, del, mod), member role
router.include_router(member_api)

# Resource : study, series, detail, (file upload)
router.include_router(resource_api)

# Viewer : viewer 전용 API (viewer/info, viewer/patient/modify 등)
router.include_router(resource_viewer_api) 

@router.get("/health", response_class=JSONResponse)
def health_check(
    request: Request
):
    return {"code" : 200, "state": "ok", "msg" : "api router OK"}