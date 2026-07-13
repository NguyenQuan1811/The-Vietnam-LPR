import os
import io
import uuid
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session
from src.models import models
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase_client: Client | None = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[ERROR] Failed to initialize Supabase client: {e}")

# múi giờ Việt Nam UTC+7
VIETNAM_TZ = timezone(timedelta(hours=7))

def get_vietnam_now() -> datetime:
    """Trả về thời gian hiện tại theo múi giờ Việt Nam (UTC+7), có timezone info."""
    return datetime.now(VIETNAM_TZ)

def to_naive_vn(dt: datetime) -> datetime:
    """Chuyển datetime timezone-aware sang naive theo giờ VN (để so sánh với DB)."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(VIETNAM_TZ)
    return dt.replace(tzinfo=None)

def create_combined_snapshot(first_img: Image.Image, bbox: list, text: str, conf: float) -> Image.Image:
    """
    Tạo ảnh snapshot kết hợp:
    - Ảnh nền: Ảnh gốc (first_img) có vẽ bounding box và nhãn nhận diện.
    - Ảnh nhỏ (inset): Ảnh crop của biển số xe, được đặt ở góc dưới bên phải
      để hiển thị đồng thời cả biển số rõ nét và toàn cảnh.
    """
    annotated = first_img.copy()
    draw = ImageDraw.Draw(annotated)
    
    color = '#00FF00'  # màu xanh lá cho bounding box và nhãn
    
    # 1. Vẽ bounding box và label lên ảnh gốc
    if bbox and len(bbox) == 4:
        x1, y1, x2, y2 = map(int, bbox)
        draw.rectangle([x1, y1, x2, y2], outline=color, width=4)
        
        label = f"{text} ({conf:.2%})"
        
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None
            
        text_w = len(label) * 7.5
        text_h = 14
        
        if font and hasattr(draw, 'textbbox'):
            try:
                l, t, r, b = draw.textbbox((x1, y1 - text_h - 4), label, font=font)
                text_w = r - l
                text_h = b - t
            except Exception:
                pass
                
        # Vẽ nền nhãn màu xanh lá chữ đen
        draw.rectangle([x1 - 2, y1 - text_h - 6, x1 + text_w + 6, y1], fill=color)
        draw.text((x1 + 2, y1 - text_h - 3), label, fill='#000000', font=font)
        
        # 2. Tạo ảnh nhỏ (inset) crop biển số xe từ ảnh gốc (chưa vẽ bbox)
        try:
            w, h = first_img.size
            x1_c = max(0, x1)
            y1_c = max(0, y1)
            x2_c = min(w, x2)
            y2_c = min(h, y2)
            
            if x2_c > x1_c and y2_c > y1_c:
                plate_crop = first_img.crop((x1_c, y1_c, x2_c, y2_c))
                
                # Tỉ lệ ảnh nhỏ: chiều rộng bằng 30% chiều rộng ảnh gốc (tối thiểu 150px, tối đa 250px)
                inset_w = max(150, min(250, int(w * 0.3)))
                crop_w, crop_h = plate_crop.size
                inset_h = int(inset_w * (crop_h / crop_w))
                
                # Resize ảnh crop dùng Resampling.LANCZOS
                plate_crop_resized = plate_crop.resize((inset_w, inset_h), Image.Resampling.LANCZOS)
                
                # Tạo viền màu xanh lá nổi bật cho ảnh crop
                border = 3
                bordered_crop = Image.new("RGB", (inset_w + 2 * border, inset_h + 2 * border), color)
                bordered_crop.paste(plate_crop_resized, (border, border))
                
                # Paste vào góc dưới bên phải (cách lề phải và lề dưới 15px)
                paste_x = w - bordered_crop.width - 15
                paste_y = h - bordered_crop.height - 15
                annotated.paste(bordered_crop, (paste_x, paste_y))
        except Exception as e:
            print(f"[ERROR] helpers.create_combined_snapshot failed to paste crop: {e}")
    else:
        # Nếu không có bbox, vẽ nhãn cảnh báo mặc định ở góc trên
        draw.text((10, 10), f"NO BBOX - {text} ({conf:.2%})", fill=color)
            
    return annotated

def save_snapshot_image(annotated_img: Image.Image) -> str:
    """Lưu ảnh snapshot vẽ bbox của biển số lên Supabase (hoặc local) và trả về URL."""
    filename = f"{uuid.uuid4()}.jpg"
    
    if supabase_client:
        try:
            img_byte_arr = io.BytesIO()
            annotated_img.save(img_byte_arr, format='JPEG')
            img_byte_arr = img_byte_arr.getvalue()
            
            res = supabase_client.storage.from_('image').upload(
                file=img_byte_arr,
                path=filename,
                file_options={"content-type": "image/jpeg"}
            )
            # Lấy public URL
            public_url = supabase_client.storage.from_('image').get_public_url(filename)
            return public_url
        except Exception as e:
            print(f"[ERROR] Upload to Supabase failed: {e}")
            return ""
            
    print("[ERROR] Supabase client is not initialized.")
    return ""

def cleanup_file(path: str):
    """Hàm dọn dẹp file tạm sau khi đã gửi phản hồi cho client."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

def is_similar_plate(p1: str, p2: str) -> bool:
    """So sánh 2 biển số bằng tỷ lệ ký tự giống nhau (similarity ratio).
    Nếu >= 70% ký tự ở cùng vị trí giống nhau → coi là cùng biển số."""
    clean1 = p1.replace("-", "").replace(".", "").replace(" ", "").upper()
    clean2 = p2.replace("-", "").replace(".", "").replace(" ", "").upper()

    if clean1 == clean2:
        return True

    # Lấy chuỗi ngắn hơn làm chuẩn đếm ký tự giống
    shorter, longer = (clean1, clean2) if len(clean1) <= len(clean2) else (clean2, clean1)

    if len(shorter) == 0:
        return False

    # Đếm ký tự giống nhau ở cùng vị trí (so với chuỗi ngắn hơn)
    match_count = sum(1 for i in range(len(shorter)) if shorter[i] == longer[i])

    similarity = match_count / len(shorter)
    return similarity >= 0.7

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
