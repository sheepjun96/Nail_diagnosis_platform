import torch
import cv2
import numpy as np
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageClassification

class LesionPredict:
    def __init__(self, model_path, class_names):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.class_names = class_names
        self.model = AutoModelForImageClassification.from_pretrained(
            model_path, num_labels=len(class_names)
        ).to(self.device)
        self.model.eval()
        self.transform = transforms.Compose([
            transforms.Resize((448, 448)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5,0.5,0.5], std=[0.5,0.5,0.5])
        ])

    def apply_clahe(self, pil_image):
        img_np = np.array(pil_image.convert("RGB"))
        
        lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)
        
        merged = cv2.merge((cl, a_channel, b_channel))
        rgb_eq = cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        
        return Image.fromarray(rgb_eq)

    def predict(self, pil_image):
        enhanced_image = self.apply_clahe(pil_image)
        input_tensor = self.transform(enhanced_image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            outputs = self.model(input_tensor)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1)
            top_prob, top_idx = torch.max(probabilities, dim=1)
            predicted_class = self.class_names[top_idx.item()]
            return {
                "predicted_class": predicted_class,
                "probability": float(top_prob.cpu().item())
            }