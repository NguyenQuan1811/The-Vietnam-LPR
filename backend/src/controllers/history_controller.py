from sqlalchemy.orm import Session
from src.services.history_service import HistoryService

class HistoryController:
    @staticmethod
    def get_history(user_id: int | None, skip: int, limit: int, db: Session):
        return HistoryService.get_history(user_id, skip, limit, db)

    @staticmethod
    def delete_history(id: int, db: Session):
        return HistoryService.delete_history(id, db)
