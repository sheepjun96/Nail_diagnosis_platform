import cv2
import numpy as np
from PIL import Image, ImageOps
from ultralytics import YOLO
import matplotlib.pyplot as plt
import os
from io import BytesIO

class NailDetect:
    def __init__(self, model_path="ai_models/yolov12.pt"):
        self.model = YOLO(model_path)
    
    def load_image(self, img_bytes):
        img = Image.open(img_bytes)
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")

    def crop_bbox(self, img, box, margin_factor=1.5):
        img_array = np.array(img)
        h_img, w_img = img_array.shape[:2]
        x1, y1, x2, y2 = box
        
        bw = x2 - x1
        bh = y2 - y1
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

        side_length = max(bw, bh) * margin_factor
        
        nx1 = int(cx - side_length / 2)
        ny1 = int(cy - side_length / 2)
        nx2 = int(cx + side_length / 2)
        ny2 = int(cy + side_length / 2)
        
        if nx1 < 0:
            shift = -nx1
            nx1 += shift
            nx2 += shift
        if ny1 < 0:
            shift = -ny1
            ny1 += shift
            ny2 += shift
        if nx2 > w_img:
            shift = nx2 - w_img
            nx1 -= shift
            nx2 -= shift
        if ny2 > h_img:
            shift = ny2 - h_img
            ny1 -= shift
            ny2 -= shift
            
        nx1 = max(0, nx1)
        ny1 = max(0, ny1)
        nx2 = min(w_img, nx2)
        ny2 = min(h_img, ny2)

        cropped = img_array[ny1:ny2, nx1:nx2]
        return cropped, [nx1, ny1, nx2, ny2]

    def detect_and_crop(self, image_path, save_dir="/curaxel_images/img/crop/"):
        img = self.load_image(image_path)
        results = self.model.predict(source=img, conf=0.25)
        
        boxes = results[0].boxes.xyxy.cpu().numpy()
        
        if len(boxes) == 0:
            return []

        if len(boxes) == 2:
            finger_names = ["left_thumb", "right_thumb"]
        else:
            finger_names = [
                "left_pinky", "left_ring", "left_middle", "left_index",
                "right_index", "right_middle", "right_ring", "right_pinky"
            ]

        sorted_indices = np.argsort(boxes[:, 0])
        base_filename = os.path.basename(image_path)
        output_list = []

        if not os.path.exists(save_dir):
            os.makedirs(save_dir)

        for i, idx in enumerate(sorted_indices):
            if i >= len(finger_names): break
            
            finger_name = finger_names[i]
            cropped, crop_info = self.crop_bbox(img, boxes[idx])
            
            if cropped is not None:
                filename_cropped = f"{finger_name}_{base_filename}"
                save_path = os.path.join(save_dir, filename_cropped)
                Image.fromarray(cropped).save(save_path)

                output_list.append({
                    "finger_name": finger_name,
                    "cropped_nail_path": save_path.replace("\\", "/"),
                    "crop_info": crop_info, # [x1, y1, x2, y2]
                    "nail_index": i
                })
        return output_list

async def nail_detect_process(model, image_path: str, save_dir: str = "/curaxel_images/img/crop/"):
    if model is not None:   
        return model.detect_and_crop(image_path=image_path, save_dir=save_dir)
    nail_detector = NailDetect(model_path="ai_models/yolov12.pt")
    return nail_detector.detect_and_crop(image_path=image_path, save_dir=save_dir)