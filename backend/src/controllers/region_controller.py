from sqlalchemy.orm import Session
from src.services.region_service import RegionService

class RegionController:
    @staticmethod
    def get_regions(db: Session):
        return RegionService.get_regions(db)
