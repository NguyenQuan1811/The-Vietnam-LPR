import os
from sqlalchemy.orm import Session
from fastapi import HTTPException
from src.models import models

class HistoryService:
    @staticmethod
    def get_history(user_id: int | None, skip: int, limit: int, db: Session):
        query = db.query(models.Detection)
        if user_id is not None:
            query = query.filter(models.Detection.user_id == user_id)
        return query.order_by(models.Detection.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()

    @staticmethod
    def delete_history(id: int, db: Session):
        item = db.query(models.Detection).filter(models.Detection.id == id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi lịch sử.")
            
        # Xóa tệp ảnh snapshot thực tế nếu tồn tại
        if item.image_path:
            local_img_path = item.image_path.lstrip('/')
            if os.path.exists(local_img_path):
                try:
                    os.remove(local_img_path)
                except Exception:
                    pass
                    
        db.delete(item)
        db.commit()
        return {"status": "success", "message": f"Đã xóa thành công bản ghi ID={id}"}
