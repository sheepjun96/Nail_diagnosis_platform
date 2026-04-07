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
    model_path = "ai_models/yolov12.pt"
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
    save_dir: str = Form("/curaxel_images/img/crop/")
):
    results = await nail_detect_process(nail_detector, image_path, save_dir)
    return JSONResponse(content={"results": results})

@router.post("/plot_nail/")
async def plot_nail(
    image_path: str = Form(...),
    crop_info: str = Form(...),
    finger_name: str = Form(...)):

    coords = json.loads(crop_info)
    x1, y1, x2, y2 = coords
    
    img = Image.open(image_path).convert("RGB")
    img_array = np.array(img)

    fig, ax = plt.subplots(1, figsize=(8,8))
    ax.imshow(img_array)
    
    rect = plt.Rectangle((x1, y1), x2-x1, y2-y1, fill=False, color='red', linewidth=3)
    ax.add_patch(rect)
    
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    ax.plot([cx, cx], [y1, y2], color='blue', linewidth=1)
    ax.plot([x1, x2], [cy, cy], color='blue', linewidth=1)
    
    plt.axis('off')
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
    buf.seek(0)
    plt.close(fig)
    
    return Response(content=buf.getvalue(), media_type="image/png")

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