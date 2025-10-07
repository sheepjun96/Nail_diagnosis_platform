# app_private.py
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(prefix="/app", tags=["app-private"])
templates = Jinja2Templates(directory="templates")

@router.get("/", response_class=HTMLResponse)
def worklist_page(request: Request):
    return templates.TemplateResponse("bootstrap/index.html", {"request": request})

@router.get("/cards", response_class=HTMLResponse)
def cards_page(request: Request):
    return templates.TemplateResponse("bootstrap/cards.html", {"request": request})

@router.get("/charts", response_class=HTMLResponse)
def charts_page(request: Request):
    return templates.TemplateResponse("bootstrap/charts.html", {"request": request})

@router.get("/tables", response_class=HTMLResponse)
def tables_page(request: Request):
    return templates.TemplateResponse("bootstrap/tables.html", {"request": request})

@router.get("/utilities-animation", response_class=HTMLResponse)
def utilities_animation_page(request: Request):
    return templates.TemplateResponse("bootstrap/utilities-animation.html", {"request": request})

@router.get("/utilities-border", response_class=HTMLResponse)
def utilities_border_page(request: Request):
    return templates.TemplateResponse("bootstrap/utilities-border.html", {"request": request})

@router.get("/utilities-color", response_class=HTMLResponse)
def utilities_color_page(request: Request):
    return templates.TemplateResponse("bootstrap/utilities-color.html", {"request": request})

@router.get("/utilities-other", response_class=HTMLResponse)
def utilities_other_page(request: Request):
    return templates.TemplateResponse("bootstrap/utilities-other.html", {"request": request})