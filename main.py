from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
from datetime import datetime
import pymysql

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

# 메모리에 수신된 환자 데이터를 저장하는 리스트
received_patients = []

@app.post("/patient-data")
async def receive_patient_data(request: Request):
    # 1) 요청 바디를 JSON으로 파싱
    try:
        patient_dict = await request.json()
        print("📝 Parsed JSON:", json.dumps(patient_dict, ensure_ascii=False))
    except Exception as e:
        print("❌ Error:", str(e))
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # 2) Pydantic을 이용한 데이터 모델 검증
    try:
        patient = PatientData(**patient_dict)
    except Exception as e:
        print("❌ Validation Error:", str(e))
        raise HTTPException(status_code=422, detail="Invalid patient data")
    
    # 3) MySQL 데이터베이스 연결 및 조회
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
    except Exception as e:
        print("❌ Database Error:", str(e))
        raise HTTPException(status_code=500, detail="Database connection error")
    finally:
        if conn:
            conn.close()

    print("✅ Database Result:", db_result)

@app.get("/")
async def get_status():
    """API 상태 및 최근 수신된 환자 목록"""
    return {
        "service": "OpenEMR Dermatology AI Integration",
        "status": "running",
        "version": "1.0.0",
        "current_time": datetime.now().isoformat(),
        "total_patients_received": len(received_patients),
        "recent_patients": received_patients[-5:] if received_patients else []
    }

@app.get("/patients")
async def get_all_patients():
    """수신된 모든 환자 데이터 조회"""
    return {
        "total_count": len(received_patients),
        "patients": received_patients
    }

if __name__ == "__main__":
    # python -m uvicorn main:app --reload
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
