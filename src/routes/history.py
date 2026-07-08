from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.models import schemas
from src.controllers.history_controller import HistoryController

router = APIRouter(tags=["History"])

@router.get("/history", response_model=List[schemas.DetectionResponse])
def get_history(user_id: int | None = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return HistoryController.get_history(user_id, skip, limit, db)

@router.delete("/history/{id}")
def delete_history(id: int, db: Session = Depends(get_db)):
    return HistoryController.delete_history(id, db)
