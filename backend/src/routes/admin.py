from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.controllers.admin_controller import AdminController

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/stats")
def admin_dashboard_stats(db: Session = Depends(get_db)):
    return AdminController.admin_dashboard_stats(db)

@router.get("/users")
def admin_list_users(db: Session = Depends(get_db)):
    return AdminController.admin_list_users(db)

@router.post("/users/{user_id}/toggle-active")
def admin_toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    return AdminController.admin_toggle_user_active(user_id, db)

@router.get("/detections/unverified")
def admin_unverified_detections(skip: int = 0, limit: int = 30, db: Session = Depends(get_db)):
    return AdminController.admin_unverified_detections(skip, limit, db)

@router.post("/verify-detection")
def admin_verify_detection(
    detection_id: int,
    correct_plate: str,
    is_correct: int,
    verified_by: int = 0,
    db: Session = Depends(get_db)
):
    return AdminController.admin_verify_detection(detection_id, correct_plate, is_correct, verified_by, db)

@router.get("/detections/search")
def admin_search_detections(
    plate: Optional[str] = None,
    source_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    verified: Optional[str] = None,
    region_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    return AdminController.admin_search_detections(plate, source_type, date_from, date_to, verified, region_id, skip, limit, db)

@router.get("/regions-stats")
def admin_regions_stats(db: Session = Depends(get_db)):
    return AdminController.admin_regions_stats(db)

@router.get("/activity-logs")
def admin_activity_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return AdminController.admin_activity_logs(skip, limit, db)
