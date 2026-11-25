"""Dependency-free configuration shared by the launcher, API and AI service."""

from dataclasses import dataclass
import json
import os
from pathlib import Path
import struct

PROJECT_ROOT = Path(__file__).resolve().parent


def _path(value: str) -> Path:
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (PROJECT_ROOT / path).resolve()


def read_safetensors_header(path: Path) -> dict:
    """Inspect dimensions without deserializing pickle or loading weights."""
    with path.open("rb") as stream:
        prefix = stream.read(8)
        if len(prefix) != 8:
            raise ValueError(f"Invalid safetensors file: {path}")
        length = struct.unpack("<Q", prefix)[0]
        if not 0 < length <= 32 * 1024 * 1024:
            raise ValueError(f"Invalid safetensors header length: {path}")
        return json.loads(stream.read(length))


@dataclass(frozen=True)
class Settings:
    document: dict
    source: Path

    @classmethod
    def load(cls, path=None):
        source = _path(str(path or os.getenv("NAIL_CONFIG_FILE", "platform_config.json")))
        with source.open(encoding="utf-8-sig") as stream:
            return cls(json.load(stream), source)

    def value(self, section, name, default=None, env=None):
        if env and env in os.environ:
            return os.environ[env]
        return self.document.get(section, {}).get(name, default)

    @property
    def detector(self):
        return self.document["models"]["nail_detector"]

    @property
    def classifier(self):
        return self.document["models"]["lesion_classifier"]

    @property
    def detector_path(self):
        return _path(os.getenv("NAIL_DETECTOR_MODEL_PATH", self.detector["path"]))

    @property
    def classifier_path(self):
        return _path(os.getenv("NAIL_LESION_MODEL_PATH", self.classifier["path"]))

    @property
    def image_root(self):
        return _path(self.value("storage", "base_dir", "data/images", "NAIL_IMAGE_ROOT"))

    @property
    def app_base_path(self):
        return os.getenv("NAIL_APP_BASE_PATH", self.value("server", "base_path", "/v2") + "/app").rstrip("/")

    @property
    def max_upload_bytes(self):
        return int(self.value("storage", "max_upload_mb", 30, "NAIL_MAX_UPLOAD_MB")) * 1024 * 1024

    @property
    def ai_url(self):
        return self.value("ai", "base_url", "http://127.0.0.1:8002", "NAIL_AI_BASE_URL").rstrip("/")

    def validate_models(self):
        if not self.detector_path.is_file():
            raise ValueError(f"Nail detector not found: {self.detector_path}")
        checkpoint = self.classifier_path / "model.safetensors" if self.classifier_path.is_dir() else self.classifier_path
        if not checkpoint.is_file():
            raise ValueError(f"Lesion classifier not found: {checkpoint}")
        header = read_safetensors_header(checkpoint)
        if self.classifier["format"] == "medsiglip_custom":
            if "fc.weight" not in header or "ln.weight" not in header:
                raise ValueError("The custom MedSigLIP checkpoint must contain fc and ln weights.")
            output_count, hidden_size = header["fc.weight"]["shape"]
            labels = self.classifier["class_names"]
            if output_count != len(labels) or len(set(labels)) != len(labels):
                raise ValueError(f"Classifier has {output_count} outputs, but class_names does not match.")
            if self.classifier["vision_config"]["hidden_size"] != hidden_size:
                raise ValueError("Configured vision hidden_size does not match the checkpoint.")
        return {"detector": str(self.detector_path), "classifier": str(checkpoint), "classes": self.classifier["class_names"]}


settings = Settings.load()
BASE_DIR = str(settings.image_root)
CONFIG_DIR = {
    "base": BASE_DIR,
    "log": str(settings.image_root / "log"),
    "data": str(settings.image_root / "data"),
    "img": str(settings.image_root / "img"),
    "extra": str(settings.image_root / "img/extra"),
    "nail": str(settings.image_root / "img/nail"),
    "crop": str(settings.image_root / "img/crop"),
}


def ensure_directories():
    for path in CONFIG_DIR.values():
        Path(path).mkdir(parents=True, exist_ok=True)
