@echo off
setlocal

REM 이 배치 파일이 있는 폴더로 이동
cd ..

REM 가상환경 활성화
call .venv\Scripts\activate

REM FastAPI(Uvicorn) 실행 (개발용)
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

REM 실행 종료 후 가상환경 비활성화 (창 안 닫고 쓰면 유용)
deactivate

pause
endlocal