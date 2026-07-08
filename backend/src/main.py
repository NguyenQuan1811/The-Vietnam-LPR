import uvicorn
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from src.config.settings import settings
from src.config.database import engine, Base, SessionLocal
from src.models import models
from src.services.ai_pipeline import init_lpr_service
from src.routes import (
    auth_router,
    predict_router,
    admin_router,
    regions_router,
    history_router
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo mô hình AI khi khởi chạy app
    init_lpr_service()
    
    # Tạo các bảng cơ sở dữ liệu nếu chưa có
    Base.metadata.create_all(bind=engine)
    
    # Seed default regions if empty
    with SessionLocal() as db:
        if db.query(models.Region).count() == 0:
            default_regions = [
                models.Region(name="Camera Cổng Chính (Gate 1)", location="Cổng chính tòa nhà A", is_active=True),
                models.Region(name="Camera Cổng Phụ (Gate 2)", location="Cổng phụ đường phía sau", is_active=True),
                models.Region(name="Camera Hầm Gửi Xe A", location="Lối vào hầm A", is_active=True),
                models.Region(name="Camera Hầm Gửi Xe B", location="Lối vào hầm B", is_active=True),
            ]
            db.add_all(default_regions)
            db.commit()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API nhận diện biển số xe Việt Nam tích hợp PostgreSQL & YOLOv8 (Kiến trúc MVC)",
    lifespan=lifespan
)

# Cấu hình CORS để Frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount thư mục static phục vụ lưu và tải ảnh snapshot
app.mount("/static", StaticFiles(directory="static"), name="static")

# Tạo router cha với prefix /api/v1
api_router = APIRouter(prefix=settings.API_V1_STR)

# Tích hợp các sub-routers vào router cha
api_router.include_router(auth_router)
api_router.include_router(predict_router)
api_router.include_router(admin_router)
api_router.include_router(regions_router)
api_router.include_router(history_router)

# Đưa router cha vào FastAPI app
app.include_router(api_router)

if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
