from fastapi import FastAPI, UploadFile, File, Form, APIRouter
from fastapi.responses import Response, JSONResponse
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import json, io, base64, os
from io import BytesIO

from utils.nail_detect import NailDetect
from utils.nail_detect import nail_detect_process
from utils.lesion_predict import LesionPredict

router = APIRouter(prefix="/api", tags=["api-public"])

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

@router.on_event("startup")
def load_model():
    print("Loading models...")
    global nail_detector
    model_path = "ai_models/yolov11-obb.pt"
    nail_detector = NailDetect(model_path)
    print("Nail detection model loaded.")

    global lesion_predictor
    model_path = "ai_models/MedSigLIP"
    lesion_predictor = LesionPredict(model_path, class_names)
    print("Lesion prediction model loaded.")
    print("All models loaded.")

@router.post("/nail_detect/", response_class=JSONResponse)
async def nail_detect(
    image_path: str = Form(...),
    save_dir: str = Form("C:/curaxel/img/crop/")
):
    results = await nail_detect_process(nail_detector, image_path, save_dir)
    outs = []
    for i, out in enumerate(results):
        outs.append({
            "nail_index": i,
            "obb_info": out["obb_info"]
        })
    return {"results": outs}

@router.post("/plot_nail/")
async def plot_nail( 
    image_path: str = Form(...),
    save_dir: str = Form("C:/curaxel/img/extra/")):

    cropped_img = np.array(Image.open(image_path))
    base_name = os.path.basename(image_path)

    finger_names = [
        "left_thumb", "right_thumb",
        "left_pinky", "left_ring", "left_middle", "left_index",
        "right_index", "right_middle", "right_ring", "right_pinky"
    ]

    prefix = None
    filename = None

    for name in finger_names:
        if base_name.startswith(name + "_"):
            prefix = name
            filename = base_name[len(name) + 1:]
            break

    if prefix is None or filename is None:
        return JSONResponse(status_code=400, content={"msg": "Invalid filename format", "filename": base_name})

    if prefix in ["left_thumb", "right_thumb"]:
        json_prefix = "thumbs"
    else:
        json_prefix = "other_fingers"

    filename_no_ext = os.path.splitext(filename)[0]
    json_filename = f"{json_prefix}_{filename_no_ext}.json"
    json_path = os.path.normpath(os.path.join("C:/curaxel/img/crop", json_filename))

    if not os.path.exists(json_path):
        return JSONResponse(status_code=404, content={"message": "JSON file not found.", "json_path": json_path})

    with open(json_path, "r", encoding="utf-8") as f:
        json_data = json.load(f)

    if prefix not in json_data:
        return JSONResponse(status_code=404, content={"msg": "Finger name not found in JSON", "finger_name": prefix})

    obb_info = json_data[prefix]["obb_info"]
    nail_index = json_data[prefix]["nail_index"]

    cx, cy, _, _, _ = obb_info

    fig, ax = plt.subplots(1, figsize=(8,8))
    ax.imshow(cropped_img)
    ax.plot([cx, cx], [0, cropped_img.shape[0]], color='black', linewidth=1)
    ax.plot([0, cropped_img.shape[1]], [cy, cy], color='black', linewidth=1)
    plt.axis('off')

    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    save_name = f"crop_{base_name}"
    save_path = os.path.join(save_dir, save_name)
    plt.savefig(save_path, bbox_inches='tight', pad_inches=0, dpi=150)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, dpi=150)
    buf.seek(0)
    plt.close(fig)
    img_bytes = buf.getvalue()

    return Response(content=img_bytes, media_type="image/png")

@router.post("/predict/", response_class=JSONResponse)
async def predict(
    image_path: str = Form(...)
):
    if not os.path.exists(image_path):
        return JSONResponse(status_code=404, content={"error": "Image file not found", "path": image_path})

    try:
        image = Image.open(image_path)
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Failed to load image: {str(e)}"})

    result = lesion_predictor.predict(image)
    return result

# uvicorn main:app --reload