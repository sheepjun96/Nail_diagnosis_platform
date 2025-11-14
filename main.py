from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from json import JSONDecodeError
from pydantic import BaseModel
from typing import Optional
import json, os, shutil, pymysql
from pathlib import Path
from config import CONFIG_DIR, ensure_directories

from contextlib import asynccontextmanager
from detection import NailDetector

## 시스템 실행 시 
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 앱 시작 시 실행 (startup 대체) ---
    ensure_directories()

    yield  # 👈 여기서 앱이 동작합니다.

    # --- 앱 종료 시 실행 (shutdown 대체) ---
    print("[SHUTDOWN] FastAPI 서버 종료 중...")

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="OpenEMR Dermatology AI Integration", lifespan=lifespan, docs_url="/docs",)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory="templates")

nail_detector = NailDetector()

## Router 정의
## 이하 플랫폼 처리는 다음과 같이 구분합니다.
# /app : front
# /api : back
from router.app_private import router as app_private
from router.app_public import router as app_public

from router.api_public import router as api_public

def require_login():
    # 로그인 쿠키/세션 검사 로직
    # if not ok: raise HTTPException(status_code=401)
    return True

app.include_router(api_public)

app.include_router(app_private, dependencies=[Depends(require_login)])
app.include_router(app_public)


# 환자 정보 데이터 모델 정의
class PatientData(BaseModel):
    pid: int
    patient_name: str
    appt_date: Optional[str] = None

# 환자 JSON 파일 경로
JSON_path = "./patient_data.json"
if not os.path.isfile(JSON_path):
    with open(JSON_path, 'w', encoding='utf-8') as f:
        json.dump({}, f, ensure_ascii=False, indent=2)

def load_data():
    try:
        with open(JSON_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (JSONDecodeError, FileNotFoundError):
        return {}
    
def save_data(data):
    with open(JSON_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# OpenEMR에서 환자 정보 수신 및 처리
@app.post("/send_patient_data")
async def receive_patient_data(request: Request):
    # 1) 요청 바디를 JSON으로 파싱
    try:
        patient_dict = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # 2) Pydantic을 이용한 데이터 모델 검증
    try:
        patient = PatientData(**patient_dict)
    except Exception as e:
        raise HTTPException(status_code=422, detail="Invalid patient data")
    
    # 3) JSON 파일에서 appt_date 중복 검사
    data = load_data()
    pid_str = str(patient.pid)

    if pid_str not in data:
        data[pid_str] = {
            "pid": patient.pid,
            "patient_name": patient.patient_name,
            "DOB": "",
            "sex": "",
            "appt_date": []
        }
    else:
        dates = data[pid_str].get("appt_date", [])
        if patient.appt_date and patient.appt_date in dates:
            return {"status": "success", "redirect_url": f"https://127.0.0.1:8000/viewer/{pid_str}/{patient.appt_date}"}
    
    # 4) MySQL 데이터베이스 연결 및 DOB, sex 조회
    conn = None
    try:
        conn = pymysql.connect(
            host='127.0.0.1',
            port=3306,
            user= 'root',
            password= '',
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        with conn.cursor() as cursor:
            sql = """
                SELECT DOB, sex
                FROM openemr.patient_data
                WHERE pid = %s
                """
            cursor.execute(sql, (patient.pid,))
            db_result = cursor.fetchone()
            if not db_result:
                raise HTTPException(status_code=404, detail="Patient not found in database")
            data[pid_str]["DOB"] = str(db_result["DOB"])
            data[pid_str]["sex"] = str(db_result["sex"])
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database connection error")
    finally:
        if conn:
            conn.close()

    if patient.appt_date:
        dates = data[pid_str].get("appt_date", [])
        if patient.appt_date not in dates:
            dates.append(patient.appt_date)
            dates.sort()
            data[pid_str]["appt_date"] = dates
    
    save_data(data)

    return {"status": "success", "redirect_url": f"https://127.0.0.1:8000/viewer/{pid_str}/{patient.appt_date}"}

# 진료 시간별 뷰어 시스템
@app.get("/viewer/{pid}/{appt_date}")
async def viewer(request: Request, pid: int, appt_date: str):
    data = load_data()
    patient_data = data.get(str(pid))
    if not patient_data or appt_date not in patient_data.get("appt_date", []):
        raise HTTPException(status_code=404, detail="Patient or appointment not found")

    # 손 이미지
    hand_img_dir = f"static/patient_images/{pid}/{appt_date}/hand"
    hand_types = ["left_thumb", "left_four", "right_thumb", "right_four"]
    hand_images = []
    for t in hand_types:
        jpg_path = f"{hand_img_dir}/{t}.jpg"
        png_path = f"{hand_img_dir}/{t}.png"
        if os.path.isfile(jpg_path):
            hand_images.append(jpg_path)
        elif os.path.isfile(png_path):
            hand_images.append(png_path)
        else:
            hand_images.append(None)

    # 손톱 이미지: cropped_nail
    nail_dir = f"static/patient_images/{pid}/{appt_date}/cropped_nail"
    os.makedirs(nail_dir, exist_ok=True)
    nail_names = ["thumb", "index", "middle", "ring", "pinky"]

    cropped_nail_images = {"left":[], "right":[]}
    for hand in ["left", "right"]:
        for name in nail_names:
            path = f"{nail_dir}/{hand}_{name}.png"
            cropped_nail_images[hand].append(path if os.path.isfile(path) else None)
            
    return templates.TemplateResponse(
        "viewer.html", {
            "request": request,
            "patient": patient_data,
            "appt_date": appt_date,
            "hand_images": hand_images,
            "cropped_nail_images": cropped_nail_images
        }
    )

@app.post("/upload-hand-image/{pid}/{appt_date}")
async def upload_hand_image(pid: int, appt_date: str, image_type: str = Form(...), file: UploadFile = File(...)):
    save_dir = f"static/patient_images/{pid}/{appt_date}/hand"
    os.makedirs(save_dir, exist_ok=True)
    filepath = f"{save_dir}/{image_type}.jpg"
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 손톱 크롭 수행
    nail_detector.crop_nail(filepath, pid, appt_date)

    return {"status": "success", "image_url": f"/{filepath}"}

@app.get("/")
async def get_status():
    data = load_data()

    return data


if __name__ == "__main__":
    # python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000 --ssl-keyfile=https/127.0.0.1-key.pem --ssl-certfile=https/127.0.0.1.pem  

    pass