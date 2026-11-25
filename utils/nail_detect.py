"""YOLO detection runs only inside the AI image."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from ultralytics import YOLO

from config import CONFIG_DIR, settings
from services.fingers import finger_names


class NailDetect:
    def __init__(self, model_path=None, device=None):
        path = Path(model_path or settings.detector_path)
        if not path.is_file():
            raise FileNotFoundError(f"Nail detector not found: {path}")
        self.model = YOLO(str(path))
        self.device = device

    @staticmethod
    def load_image(image_path):
        with Image.open(image_path) as source:
            return ImageOps.exif_transpose(source).convert("RGB")

    def crop_bbox(self, image, box, margin_factor=None):
        margin_factor = margin_factor or settings.detector.get("crop_margin", 1.5)
        x1, y1, x2, y2 = map(float, box)
        side = min(max(x2 - x1, y2 - y1) * margin_factor, image.width, image.height)
        left = max(0, min(int((x1 + x2 - side) / 2), image.width - int(side)))
        top = max(0, min(int((y1 + y2 - side) / 2), image.height - int(side)))
        coords = [left, top, min(image.width, left + int(side)), min(image.height, top + int(side))]
        return np.asarray(image.crop(coords)), coords

    def detect_and_crop(self, image_path, save_dir=None, capture_type="auto"):
        image = self.load_image(image_path)
        results = self.model.predict(
            source=image, conf=float(settings.detector.get("confidence", 0.25)),
            device=self.device, verbose=False,
        )
        boxes = results[0].boxes.xyxy.cpu().numpy()
        confidences = results[0].boxes.conf.cpu().numpy()
        names, complete = finger_names(len(boxes), capture_type)
        output_dir = Path(save_dir or CONFIG_DIR["crop"])
        output_dir.mkdir(parents=True, exist_ok=True)
        output = []
        for index, box_index in enumerate(np.argsort(boxes[:, 0])):
            cropped, coords = self.crop_bbox(image, boxes[box_index])
            if not cropped.size:
                continue
            name = names[index]
            destination = output_dir / f"{name}_{Path(image_path).name}"
            Image.fromarray(cropped).save(destination, format="PNG")
            output.append({
                "finger_name": name,
                "cropped_nail_path": destination.as_posix(),
                "crop_info": coords,
                "nail_index": index,
                "detection_confidence": float(confidences[box_index]),
                "assignment_complete": complete,
            })
        return output


async def nail_detect_process(model, image_path, save_dir=None, capture_type="auto"):
    import asyncio
    if model is None:
        raise RuntimeError("Use the initialized AI service model; per-request loading is disabled.")
    return await asyncio.to_thread(model.detect_and_crop, image_path, save_dir, capture_type)
