import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401  (registrasi model ke Base.metadata)
from database import Base, engine
from routers import (
    analysis,
    auth,
    documents,
    history,
    report,
    runs,
    structure_mapper,
    structure_mapper_organization,
)

load_dotenv()

app = FastAPI(title="Talenta Sync Config AI API")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Di lingkungan serverless (Vercel), beberapa instance bisa mencoba
        # membuat tabel secara bersamaan. Kalau tabel sudah ada (dibuat oleh
        # instance lain), abaikan saja - bukan error yang perlu menghentikan
        # aplikasi.
        pass


app.include_router(auth.router)
app.include_router(runs.router)
app.include_router(documents.router)
app.include_router(analysis.router)
app.include_router(report.router)
app.include_router(history.router)
app.include_router(structure_mapper.router)
app.include_router(structure_mapper_organization.router)


@app.get("/health")
def health():
    return {"status": "ok"}
