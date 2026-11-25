"""Validated image storage; client filenames never become filesystem paths."""

import asyncio
from pathlib import Path
import tempfile
import uuid
import warnings

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from config import settings


def storage_path(directory, name, *, must_exist=False):
    root = Path(directory).resolve()
    path = Path(name)
    if path.is_absolute() or path.name != str(name) or "\\" in str(name):
        raise HTTPException(400, "Invalid image filename.")
    target = (root / path).resolve()
    if target == root or not target.is_relative_to(root):
        raise HTTPException(400, "Invalid image path.")
    if must_exist and not target.is_file():
        raise HTTPException(404, "Image not found.")
    return target


def shared_image_path(value):
    root = settings.image_root.resolve()
    candidate = Path(value)
    target = (candidate if candidate.is_absolute() else root / candidate).resolve()
    if not target.is_relative_to(root / "img") or not target.is_file():
        raise HTTPException(400, "Image must be an existing file in platform image storage.")
    return target


def _normalize_image(source, destination):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(source) as probe:
                if probe.width * probe.height > int(settings.value("storage", "max_image_pixels", 40_000_000)):
                    raise HTTPException(413, "Image resolution exceeds the configured limit.")
                if probe.format not in {"PNG", "JPEG", "WEBP"}:
                    raise HTTPException(415, "Only PNG, JPEG and WebP images are supported.")
                probe.verify()
            with Image.open(source) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.info.clear()
                image.save(destination, format="PNG")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(415, "Invalid or unsupported image.") from exc


async def save_uploaded_image(upload: UploadFile, directory, prefix="image"):
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    destination = storage_path(root, f"{prefix}_{uuid.uuid4().hex}.png")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=root, suffix=".upload", delete=False) as output:
            temporary = Path(output.name)
            size = 0
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise HTTPException(413, "Image exceeds the configured upload limit.")
                output.write(chunk)
        if not size:
            raise HTTPException(400, "The uploaded file is empty.")
        await asyncio.to_thread(_normalize_image, temporary, destination)
        return destination
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
        await upload.close()


def remove_files(paths):
    for path in paths:
        target = Path(path).resolve()
        if target.is_relative_to(settings.image_root):
            target.unlink(missing_ok=True)
