# app_public.py
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(prefix="/api", tags=["api-public"])
templates = Jinja2Templates(directory="templates")

@router.get("/test", response_class=HTMLResponse)
def upload_form(request: Request):
    return {"code" : "ok", "msg" : "api router OK"}

@router.post("/upload", response_class=HTMLResponse)
def upload_form(request: Request):
    return templates.TemplateResponse("bootstrap/login.html", {"request": request})