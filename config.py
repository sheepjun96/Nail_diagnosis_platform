import os

BASE_DIR = r"C:\curaxel"

# 하위 경로들
CONFIG_DIR = {
    "base": BASE_DIR,
    "log": os.path.join(BASE_DIR, "log"),
    "data": os.path.join(BASE_DIR, "data"),
    "img": os.path.join(BASE_DIR, "img"),
    "extra": os.path.join(BASE_DIR, "img", "extra"),
    "nail": os.path.join(BASE_DIR, "img", "nail"),
    "crop": os.path.join(BASE_DIR, "img", "crop"),
}

# 디렉토리 자동 생성 함수
def ensure_directories():
    for key, path in CONFIG_DIR.items():
        if not os.path.exists(path):
            os.makedirs(path, exist_ok=True)
            print(f"[INIT] '{path}' 디렉토리를 생성했습니다.")