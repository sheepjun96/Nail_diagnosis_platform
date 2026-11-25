"""Prepare writable directories, including volumes created by the old root API.

Only directory ownership is changed. Existing image files are not rewritten.
"""
import os
from pathlib import Path

from config import CONFIG_DIR, ensure_directories, settings


def prepare():
    ensure_directories()
    root = settings.image_root.resolve()
    for value in CONFIG_DIR.values():
        path = Path(value).resolve()
        if path != root and not path.is_relative_to(root):
            raise RuntimeError("Image directory must remain inside the image volume.")
        os.chown(path, 10001, 10001)


if __name__ == "__main__":
    prepare()
