from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
from json import JSONDecodeError
import pymysql
import os

app = FastAPI(title="OpenEMR Dermatology AI Integration")

# CORS 설정 (OpenEMR에서 로컬 테스트를 위해 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# 환자 정보 데이터 모델 정의
class PatientData(BaseModel):
    pid: int
    patient_name: str
    appt_date: Optional[str] = None

# 환자 JSON 파일 경로
JSON_path = "./patient_data.json"

if not os.path.isfile(JSON_path):
    with open(JSON_path, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)

def load_data():
    try:
        with open(JSON_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (JSONDecodeError, FileNotFoundError):
        return {}
    
def save_data(data):
    with open(JSON_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

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

    if pid_str in data:
        dates = data[pid_str].get("appt_date", [])
        if patient.appt_date and patient.appt_date in dates:
            # 중복된 날짜가 있으면 코드 스킵, 기존 정보 유지
            return {"status": "duplicate",
                    "message": "Appointment date already exists",
                    "patinet": data}
    else:
        data[pid_str] = {
            "pid": patient.pid,
            "patient_name": patient.patient_name,
            "DOB": "",
            "sex": "",
            "appt_date": []
        }
    
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

    return {
        "status": "success", 
        "patient": data
        }

@app.get("/")
async def get_status():
    return load_data()

if __name__ == "__main__":
    # python -m uvicorn main:app --reload
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)