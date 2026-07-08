import os
import uuid
from PIL import Image
from sqlalchemy.orm import Session
from src.models import models

def save_snapshot_image(annotated_img: Image.Image) -> str:
    """Lưu ảnh snapshot vẽ bbox của biển số vào thư mục static và trả về URL tương đối."""
    os.makedirs("static/snapshots", exist_ok=True)
    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join("static", "snapshots", filename)
    annotated_img.save(filepath, format="JPEG")
    return f"/static/snapshots/{filename}"

def cleanup_file(path: str):
    """Hàm dọn dẹp file tạm sau khi đã gửi phản hồi cho client."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

def is_similar_plate(p1: str, p2: str) -> bool:
    clean1 = p1.replace("-", "").replace(".", "").replace(" ", "").upper()
    clean2 = p2.replace("-", "").replace(".", "").replace(" ", "").upper()

    if clean1 == clean2:
        return True
    if abs(len(clean1) - len(clean2)) > 1:
        return False

    diff_count = 0
    max_len = max(len(clean1), len(clean2))
    for i in range(max_len):
        if i >= len(clean1) or i >= len(clean2):
            diff_count += 1
            continue
        if clean1[i] != clean2[i]:
            diff_count += 1
            
    return diff_count <= 1

def log_activity(db: Session, user_id: int | None, action: str, detail: str = "", ip_address: str = ""):
    """Ghi một dòng nhật ký hoạt động vào cơ sở dữ liệu."""
    try:
        entry = models.ActivityLog(
            user_id=user_id,
            action=action,
            detail=detail,
            ip_address=ip_address
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
