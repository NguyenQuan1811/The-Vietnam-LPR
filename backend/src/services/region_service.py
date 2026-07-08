from sqlalchemy.orm import Session
from src.models import models

class RegionService:
    @staticmethod
    def get_regions(db: Session):
        return db.query(models.Region).filter(models.Region.is_active == True).all()
