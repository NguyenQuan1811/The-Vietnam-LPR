from fastapi import UploadFile, BackgroundTasks, WebSocket
from sqlalchemy.orm import Session
from src.services.predict_service import PredictService

class PredictController:
    @staticmethod
    async def predict_image(file: UploadFile, user_id: int | None, region_id: int | None, db: Session):
        return await PredictService.predict_image(file, user_id, region_id, db)

    @staticmethod
    async def predict_video(file: UploadFile, user_id: int | None, region_id: int | None, db: Session):
        return await PredictService.predict_video(file, user_id, region_id, db)

    @staticmethod
    async def get_task_status(task_id: str, db: Session):
        return await PredictService.get_task_status(task_id, db)

    @staticmethod
    async def download_task_result(task_id: str, background_tasks: BackgroundTasks, db: Session):
        return await PredictService.download_task_result(task_id, background_tasks, db)

    @staticmethod
    async def handle_websocket(websocket: WebSocket):
        return await PredictService.handle_websocket(websocket)
