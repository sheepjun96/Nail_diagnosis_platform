# api_public.py
import json, io, base64, os
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from config import CONFIG_DIR
from utils.nail_detect import nail_detect_process
import aiomysql
from db import get_conn
import matplotlib.pyplot as plt
from PIL import Image
import numpy as np

from router.services.resource import add_file_origin, add_file_crop, add_file_extra
from utils.lesion_predict import LesionPredict

router = APIRouter(prefix="/api", tags=["api-public"])
SAVE_ORIGIN_DIR = CONFIG_DIR["nail"]
SAVE_NAIL_DIR = CONFIG_DIR["crop"]
SAVE_EXTRA_DIR = CONFIG_DIR["extra"]

class_names = [
    "Acral_Lentiginous_Melanoma",
    "Healthy_Nail",
    "Onychogryphosis",
    "Onychomycosis",
    "blue_finger",
    "clubbing",
    "pitting",
    "psoriasis"
]

def parse_finger_type(upload_uri: str) -> str:
    base = upload_uri.split("_gcubme")[0]

    mapping = {
        "right_thumb": "rt",
        "right_index": "ri",
        "right_middle": "rm",
        "right_ring": "rr",
        "right_pinky": "rp",

        "left_thumb": "lt",
        "left_index": "li",
        "left_middle": "lm",
        "left_ring": "lr",
        "left_pinky": "lp",
    }

    return mapping.get(base, "unknown")

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
    file: UploadFile = File(...),
    conn: aiomysql.Connection = Depends(get_conn),
):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{type}_{timestamp}.png"

    save_path = os.path.join(SAVE_ORIGIN_DIR, filename)
    save_path = save_path.replace("\\", "/")

    origin_seq = await add_file_origin(
        conn = conn,
        upload_type= type,
        upload_uri= filename,
    )

    print("origin_seq", origin_seq)

    # 파일 저장
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # nail_detect API 호출
    detection_results = await nail_detect_process(model=None, image_path=save_path, save_dir=SAVE_NAIL_DIR)

    model_path = "ai_models/MedSigLIP"
    lesion_predictor = LesionPredict(model_path, class_names)

    for item in detection_results:
        finger_name = item["finger_name"]
        finger_type = parse_finger_type(upload_uri=finger_name)
        cropped_path = item["cropped_nail_path"]
        obb_info_str = json.dumps(item["obb_info"]) 

        crop_filename = str(cropped_path).split("/")[-1]
        
        ai_result = lesion_predictor.predict(Image.open(cropped_path))
        print(">> AI Result", ai_result)

        crop_seq = await add_file_crop(
            conn = conn,
            upload_type = type,
            upload_uri = crop_filename,
            origin_seq =origin_seq["insert_seq"],
            origin_uri = filename,
            obb_info = obb_info_str,
            ai_info = json.dumps(ai_result),
            finger_index = finger_type
        )

        cropped_img = np.array(Image.open(cropped_path))

        cx, cy, _, _, _ = item["obb_info"]
        fig, ax = plt.subplots(1, figsize=(8,8))
        ax.imshow(cropped_img)
        ax.plot([cx, cx], [0, cropped_img.shape[0]], color='black', linewidth=1)
        ax.plot([0, cropped_img.shape[1]], [cy, cy], color='black', linewidth=1)
        plt.axis('off')

        extra_save_name = f"plot_{crop_filename}"
        plot_save_path = os.path.join(SAVE_EXTRA_DIR, extra_save_name)
        plt.savefig(plot_save_path, bbox_inches='tight', pad_inches=0, dpi=150)

        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, dpi=150)
        buf.seek(0)
        plt.close(fig)

        extra_psar_seq = await add_file_extra(
            conn = conn,
            upload_type = type,
            upload_uri = extra_save_name,
            origin_seq =origin_seq["insert_seq"],
            origin_uri = filename,
            obb_info = obb_info_str,
            finger_index = finger_type,
            upload_filetype = 4
        )


    return {
        "code": 200,
        "state": "success",
        "type": type,
        "filename": filename,
        "path": save_path.replace("\\", "/"),
        "detection_results": detection_results
    }
