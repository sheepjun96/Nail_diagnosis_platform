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

# Member : list(add, del, mod), member role
router.include_router(member_api)

# Resource : study, series, detail, (file upload)
router.include_router(resource_api)

@router.get("/health", response_class=JSONResponse)
def health_check(
    request: Request
):
    return {"code" : 200, "state": "ok", "msg" : "api router OK"}