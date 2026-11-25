"""Authenticated camera/browser upload; inference runs in the private AI service."""
import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from auth import require_upload_access
from config import CONFIG_DIR
from db import transaction
from router.services.resource import add_file_crop, add_file_extra, add_file_origin
from services.ai_client import call_ai
from services.cache import rate_limit
from services.storage import remove_files, save_uploaded_image, shared_image_path

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_form(
    request: Request,
    type: str = Form(..., min_length=1, max_length=50, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$"),
    file: UploadFile = File(...),
    capture_type: str = Form("auto"),
    actor=Depends(require_upload_access),
):
    await rate_limit(request, actor["identity"])
    original = await save_uploaded_image(file, CONFIG_DIR["nail"], prefix=type)
    created = [original]
    try:
        result = await call_ai(request, "analyze", {
            "image_path": original.relative_to(Path(CONFIG_DIR["base"])).as_posix(),
            "capture_type": capture_type,
        })
        items = result["results"]
        for item in items:
            created.extend([shared_image_path(item["cropped_nail_path"]), shared_image_path(item["plot_path"])])
        # No database connection is held during model inference.
        async with transaction(request.app.state.db_pool) as conn:
            origin = await add_file_origin(conn, type, original.name)
            for item in items:
                crop = Path(item["cropped_nail_path"])
                plot = Path(item["plot_path"])
                await add_file_crop(
                    conn, type, crop.name, str(origin["insert_seq"]), original.name,
                    json.dumps(item["crop_info"]), json.dumps(item["ai_result"]), item["finger_code"],
                )
                await add_file_extra(
                    conn, type, plot.name, str(origin["insert_seq"]), original.name,
                    json.dumps(item["crop_info"]), item["finger_code"], 4,
                )
        return {
            "code": 200, "state": "success", "type": type, "filename": original.name,
            "detection_results": items, "warnings": result.get("warnings", []),
        }
    except BaseException:
        remove_files(created)
        raise
