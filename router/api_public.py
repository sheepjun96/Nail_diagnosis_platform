# api_public.py
import os
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from config import CONFIG_DIR

router = APIRouter(prefix="/api", tags=["api-public"])
SAVE_NAIL_DIR = CONFIG_DIR["nail"]

@router.get("/health", response_class=JSONResponse)
def health_check(
    request: Request
):
    return {"code" : 200, "state": "ok", "msg" : "api router OK"}

# Upload Resberry or canon, etc..
@router.post("/upload", response_class=JSONResponse)
async def upload_form(
    request: Request,
    type: str = Form(...),
    file: UploadFile = File(...)
):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{type}_{timestamp}.png"

    save_path = os.path.join(SAVE_NAIL_DIR, filename)

    # 파일 저장
    with open(save_path, "wb") as f:
        f.write(await file.read())

    return {
        "code": 200,
        "state": "success",
        "type": type,
        "filename": filename,
        "path": save_path.replace("\\", "/")
    }
