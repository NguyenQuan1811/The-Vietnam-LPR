from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, WebSocket
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.controllers.predict_controller import PredictController

router = APIRouter(tags=["Prediction"])

@router.post("/predict-image")
async def predict_image(
    file: UploadFile = File(...), 
    user_id: int | None = None, 
    region_id: int | None = None, 
    db: Session = Depends(get_db)
):
    return await PredictController.predict_image(file, user_id, region_id, db)

@router.post("/predict-video")
async def predict_video(
    file: UploadFile = File(...), 
    user_id: int | None = None, 
    region_id: int | None = None, 
    db: Session = Depends(get_db)
):
    return await PredictController.predict_video(file, user_id, region_id, db)

@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str, db: Session = Depends(get_db)):
    return await PredictController.get_task_status(task_id, db)

@router.get("/tasks/{task_id}/download")
async def download_task_result(task_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    return await PredictController.download_task_result(task_id, background_tasks, db)

@router.websocket("/ws/lpr")
async def websocket_lpr(websocket: WebSocket):
    return await PredictController.handle_websocket(websocket)
