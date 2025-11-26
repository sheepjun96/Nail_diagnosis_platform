from fastapi import FastAPI, UploadFile, File, Form, APIRouter
from fastapi.templating import Jinja2Templates
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
templates = Jinja2Templates(directory="templates")

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
    obb_info: str = Form(...),
    image_path: str = Form(...),
    save_dir: str = Form("C:/curaxel/img/extra/")):
    
    cropped_img = np.array(Image.open(image_path))
    
    obb = json.loads(obb_info)
    cx, cy, _, _, _ = obb

    fig, ax = plt.subplots(1, figsize=(8,8))
    ax.imshow(cropped_img)  
    ax.plot([cx, cx], [0, cropped_img.shape[0]], color='black', linewidth=1)
    ax.plot([0, cropped_img.shape[1]], [cy, cy], color='black', linewidth=1)
    plt.axis('off')

    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    base_name = os.path.basename(image_path)
    save_name = f"crop_{base_name}"
    save_path = os.path.join(save_dir, save_name)
    plt.savefig(save_path, bbox_inches='tight', pad_inches=0, dpi=150)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, dpi=150)
    buf.seek(0)
    plt.close(fig)
    img_bytes = buf.getvalue()

    return Response(content=img_bytes, media_type="image/png")

@router.post("/predict/")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    result = lesion_predictor.predict(image)
    return result

# uvicorn main:app --reload