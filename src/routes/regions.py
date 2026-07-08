from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.controllers.region_controller import RegionController

router = APIRouter(tags=["Regions"])

@router.get("/regions")
def get_regions(db: Session = Depends(get_db)):
    return RegionController.get_regions(db)
