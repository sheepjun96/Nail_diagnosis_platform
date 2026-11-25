"""Compatibility endpoints proxy authenticated requests to the inference service."""
import json

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import Response

from config import CONFIG_DIR
from services.ai_client import call_ai
from services.storage import shared_image_path

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/nail_detect/")
async def nail_detect(request: Request, image_path: str = Form(...),
                      save_dir: str = Form(""), capture_type: str = Form("auto")):
    if save_dir and save_dir.rstrip("/") != CONFIG_DIR["crop"].rstrip("/"):
        raise HTTPException(400, "Custom output directories are not allowed.")
    path = shared_image_path(image_path)
    return await call_ai(request, "detect", {"image_path": path.as_posix(), "capture_type": capture_type})


@router.post("/predict/")
async def predict(request: Request, image_path: str = Form(...)):
    path = shared_image_path(image_path)
    return await call_ai(request, "predict", {"image_path": path.as_posix()})


@router.post("/plot_nail/")
async def plot_nail(request: Request, image_path: str = Form(...),
                    crop_info: str = Form(...), finger_name: str = Form("")):
    path = shared_image_path(image_path)
    try:
        coords = json.loads(crop_info)
    except ValueError as exc:
        raise HTTPException(422, "crop_info must contain four numeric coordinates.") from exc
    content = await call_ai(request, "plot", {"image_path": path.as_posix(), "crop_info": coords}, image_response=True)
    return Response(content, media_type="image/png")
