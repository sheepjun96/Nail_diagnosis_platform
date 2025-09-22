from roboflow import Roboflow
import os, cv2

class NailDetector:
    def __init__(self):
        from roboflow import Roboflow
        rf = Roboflow(api_key="JvYFbwrmQKx1JaMybEKR")
        project = rf.workspace().project("nail-bheyh-fbsye")
        self.model = project.version(1).model

    def crop_nail(self, image_path: str, pid: int, appt_date: str):
        img = cv2.imread(image_path)
        if img is None:
            print(f"Failed to load image: {image_path}")
            return
        
        h, w = img.shape[:2]

        preds = self.model.predict(img, confidence=85).json().get("predictions", [])

        save_dir = f"static/patient_images/{pid}/{appt_date}/cropped_nail"
        os.makedirs(save_dir, exist_ok=True)

        filename = os.path.basename(image_path).lower()
        
        if "left_four" in filename:
            sorted_preds = sorted(preds, key=lambda x: x["x"])
            order = ["left_pinky", "left_ring", "left_middle", "left_index"]
        elif "right_four" in filename:
            sorted_preds = sorted(preds, key=lambda x: x["x"])
            order = ["right_index", "right_middle", "right_ring", "right_pinky"]
        elif "thumb" in filename:
            sorted_preds = sorted(preds, key=lambda x: x["confidence"], reverse=True)
            order = ["left_thumb"] if "left" in filename else ["right_thumb"]
        else:
            print(f"Unknown image type for cropping: {filename}")
            return
        
        # 각각 크롭 및 저장
        for i, pred in enumerate(sorted_preds):
            if i >= len(order):
                break
            cx, cy = int(pred["x"]), int(pred["y"])
            w_box, h_box = int(pred["width"]), int(pred["height"])

            x1 =max(0, cx - w_box // 2 - 40)
            y1 = max(0, cy - h_box // 2 - 40)
            x2 = min(w, cx + w_box // 2 + 40)
            y2 = min(h, cy + h_box // 2 + 100)

            cropped = img[y1:y2, x1:x2]
            out_path = os.path.join(save_dir, f"{order[i]}.png")
            cv2.imwrite(out_path, cropped)
            print(f"Cropped image saved to: {out_path}")