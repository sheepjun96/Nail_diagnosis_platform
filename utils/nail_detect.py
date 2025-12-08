import cv2
import numpy as np
from PIL import Image, ExifTags
from ultralytics import YOLO
import matplotlib.pyplot as plt
import os
from io import BytesIO

class NailDetect:
    def __init__(self, model_path):
        self.model = YOLO(model_path)
    
    def load_image(self, img_bytes):
        img = Image.open(img_bytes)
        try:
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation] == "Orientation":
                    break
            exif = img._getexif()
            if exif is not None:
                orientation_value = exif.get(orientation, 1)
                if orientation_value == 3:
                    img = img.rotate(180, expand=True)
                elif orientation_value == 6:
                    img = img.rotate(270, expand=True)
                elif orientation_value == 8:
                    img = img.rotate(90, expand=True)
        except:
            pass
        return img

    def crop_rotated_bbox(self, img, obb_arr, idx=0):
        if idx >= obb_arr.shape[0]:
            return None, None
        obb = obb_arr[idx]
        if len(obb) == 5:
            cx, cy, w, h, angle = obb
        elif len(obb) == 4:
            cx, cy, w, h = obb
            angle = 0.0
        else:
            return None, None
        img_array = np.array(img)
        if len(img_array.shape) == 2:
            img_cv = img_array
        else:
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        angle_deg = np.degrees(angle) % 360

        center = (cx, cy)
        rotation_matrix = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
        img_h, img_w = img_cv.shape[:2]
        rotated_full = cv2.warpAffine(img_cv, rotation_matrix, (img_w, img_h),
                                       flags=cv2.INTER_LINEAR,
                                       borderMode=cv2.BORDER_CONSTANT,
                                       borderValue=(255, 255, 255))
        cx_rot, cy_rot = cx, cy
        margin = 1.5
        half_w, half_h = (w * margin) / 2, (h * margin) / 2
        x1 = max(0, int(cx_rot - half_w))
        x2 = min(img_w, int(cx_rot + half_w))
        y1 = max(0, int(cy_rot - half_h))
        y2 = min(img_h, int(cy_rot + half_h))

        cropped_rotated = rotated_full[y1:y2, x1:x2]
        if len(cropped_rotated.shape) == 3:
            cropped_rotated = cv2.cvtColor(cropped_rotated, cv2.COLOR_BGR2RGB)
        crop_h, crop_w = cropped_rotated.shape[:2]

        if (angle_deg > 45 and angle_deg < 135) or (angle_deg > 225 and angle_deg < 315):
            if crop_w > crop_h:
                cropped_rotated = cv2.rotate(cropped_rotated, cv2.ROTATE_90_CLOCKWISE)

        cx_crop = cropped_rotated.shape[1] // 2
        cy_crop = cropped_rotated.shape[0] // 2
        obb_info = (cx_crop, cy_crop, cropped_rotated.shape[1], cropped_rotated.shape[0], 0.0)
        return cropped_rotated, obb_info

    def detect_and_crop(self, image_path, save_dir):
        with open(image_path, "rb") as f:
            img_bytes = BytesIO(f.read())
        img = self.load_image(img_bytes)
        results = self.model(img)

        obb_arrs = []
        for r in results:
            if r.obb is None:
                continue
            obb_arrs.append(r.obb.xywhr.cpu().numpy())

        if len(obb_arrs) == 0:
            return []
        
        obb_arr = np.vstack(obb_arrs)

        if len(obb_arr) == 2:
            finger_names = ["left_thumb", "right_thumb"]
        else:
            finger_names = [
                "left_pinky", "left_ring", "left_middle", "left_index",
                "right_index", "right_middle", "right_ring", "right_pinky"
            ]

        sorted_indices = np.argsort(obb_arr[:, 0])
        base_filename = os.path.basename(image_path)
        output_list = []

        if not os.path.exists(save_dir):
            os.makedirs(save_dir)

        for i, (idx, finger_name) in enumerate(zip(sorted_indices, finger_names)):
            cropped, obb_info = self.crop_rotated_bbox(img, obb_arr, idx=idx)
            if cropped is not None:
                filename_cropped = f"{finger_name}_{base_filename}"
                save_path = os.path.join(save_dir, filename_cropped)
                img_to_save = Image.fromarray(cropped)
                img_to_save.save(save_path)
                print(f"Saved: {save_path}")

                output_list.append({
                    "finger_name": finger_name,
                    "cropped_nail_path": save_path.replace("\\", "/"),
                    "obb_info": list(obb_info),
                    "nail_index": i
                })

        return output_list

async def nail_detect_process(model, image_path: str, save_dir: str = "C:/curaxel/img/crop/"):
    if model is not None:
        return model.detect_and_crop(image_path=image_path, save_dir=save_dir)
    nail_detector = NailDetect(model_path="ai_models/yolov11-obb.pt")
    return nail_detector.detect_and_crop(image_path=image_path, save_dir=save_dir)