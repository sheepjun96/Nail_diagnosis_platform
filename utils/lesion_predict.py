"""Load the actual custom MedSigLIP checkpoint without downloading a base model.

The research notebooks use get_image_features -> LayerNorm -> Linear.
Their multi-sample dropouts are identities in eval mode, so the vision encoder,
LayerNorm and classifier are sufficient for identical inference.
"""
import hashlib
import json
from pathlib import Path

import torch
from PIL import ImageOps
from safetensors import safe_open
from transformers import AutoModelForImageClassification, SiglipImageProcessor, SiglipVisionConfig, SiglipVisionModel

from config import settings


class LesionPredict:
    def __init__(self, model_path=None, class_names=None):
        spec = settings.classifier
        path = Path(model_path or settings.classifier_path)
        checkpoint = path / "model.safetensors" if path.is_dir() else path
        requested_device = settings.value("ai", "device", "auto", "NAIL_AI_DEVICE")
        self.device = torch.device(
            ("cuda" if torch.cuda.is_available() else "cpu") if requested_device == "auto" else requested_device
        )
        self.class_names = list(class_names or spec["class_names"])
        self.custom = spec["format"] == "medsiglip_custom"
        if self.custom:
            self._load_custom(checkpoint, spec)
        else:
            self.model = AutoModelForImageClassification.from_pretrained(str(path), local_files_only=True)
            if self.model.config.num_labels != len(self.class_names):
                raise ValueError("Configured class names do not match the model output.")
        self.model.to(self.device).eval()
        normalization = spec.get("normalization", {})
        self.processor = SiglipImageProcessor(
            size={"height": spec["image_size"], "width": spec["image_size"]},
            image_mean=normalization.get("mean", [0.5] * 3),
            image_std=normalization.get("std", [0.5] * 3),
        )
        self.use_clahe = spec.get("use_clahe", False)
        fingerprint = json.dumps(spec, sort_keys=True) + f":{checkpoint.stat().st_size}:{checkpoint.stat().st_mtime_ns}"
        self.version = hashlib.sha256(fingerprint.encode()).hexdigest()[:16]

    def _load_custom(self, checkpoint, spec):
        # Allocate no random 400M-parameter model; safetensors supplies every tensor.
        with torch.device("meta"):
            self.model = SiglipVisionModel(SiglipVisionConfig(**spec["vision_config"]))
            self.norm = torch.nn.LayerNorm(spec["vision_config"]["hidden_size"])
            self.head = torch.nn.Linear(spec["vision_config"]["hidden_size"], len(self.class_names))
        with safe_open(str(checkpoint), framework="pt", device="cpu") as weights:
            vision = {
                key.removeprefix("backbone."): weights.get_tensor(key)
                for key in weights.keys() if key.startswith("backbone.vision_model.")
            }
            self.model.load_state_dict(vision, strict=True, assign=True)
            self.norm.load_state_dict({
                "weight": weights.get_tensor("ln.weight"), "bias": weights.get_tensor("ln.bias"),
            }, strict=True, assign=True)
            self.head.load_state_dict({
                "weight": weights.get_tensor("fc.weight"), "bias": weights.get_tensor("fc.bias"),
            }, strict=True, assign=True)
        # position_ids is a non-persistent buffer, so it is not in the checkpoint.
        embeddings = self.model.vision_model.embeddings
        embeddings.position_ids = torch.arange(embeddings.position_ids.shape[-1]).unsqueeze(0)
        self.norm.to(self.device).eval()
        self.head.to(self.device).eval()

    def predict(self, pil_image):
        image = ImageOps.exif_transpose(pil_image).convert("RGB")
        if self.use_clahe:
            import cv2
            import numpy as np
            from PIL import Image
            lab = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2LAB)
            lab[:, :, 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lab[:, :, 0])
            image = Image.fromarray(cv2.cvtColor(lab, cv2.COLOR_LAB2RGB))
        pixel_values = self.processor(images=image, return_tensors="pt")["pixel_values"].to(self.device)
        with torch.inference_mode():
            outputs = self.model(pixel_values=pixel_values)
            logits = self.head(self.norm(outputs.pooler_output)) if self.custom else outputs.logits
            probabilities = torch.softmax(logits, dim=-1)[0].float().cpu()
        index = int(probabilities.argmax())
        return {
            "predicted_class": self.class_names[index],
            "probability": float(probabilities[index]),
            "predicted_index": index,
            "model_version": self.version,
        }
