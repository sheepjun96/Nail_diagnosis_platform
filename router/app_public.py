# app_public.py
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(prefix="/app", tags=["app-public"])
templates = Jinja2Templates(directory="templates")

@router.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse("bootstrap/login.html", {"request": request})

@router.get("/register", response_class=HTMLResponse)
def register_form(request: Request):
    return templates.TemplateResponse("bootstrap/register.html", {"request": request})

@router.get("/forgot-password", response_class=HTMLResponse)
def fotgotpassword_form(request: Request):
    return templates.TemplateResponse("bootstrap/forgot-password.html", {"request": request})

@router.get("/404", response_class=HTMLResponse)
def error_404_form(request: Request):
    return templates.TemplateResponse("bootstrap/404.html", {"request": request})

@router.get("/blank", response_class=HTMLResponse)
def error_blank_form(request: Request):
    return templates.TemplateResponse("bootstrap/blank.html", {"request": request})