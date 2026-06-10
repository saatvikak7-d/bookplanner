import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .router import api_router
from .config import settings

app = FastAPI(title="BookPlanner AI Service", version="1.0.0")

# CORS configuration – allow Vite dev server and optionally all origins in debug mode
if settings.debug:
    origins = ["*"]
else:
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
