# Logic chạy 3 giai đoạn AI + Tracking + Hậu xử lý
import os
import numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageDraw, ImageFont
from ultralytics import YOLO
from src.config.settings import settings

# ----------------- Image Processing Helpers -----------------

def preprocess_plate(plate_img: Image.Image) -> Image.Image:
    """Làm sạch và tối ưu ảnh biển số trước khi nhận diện ký tự."""
    gray = plate_img.convert('L')
    arr = np.array(gray)
    
    mean_val = arr.mean()
    bright_ratio = np.sum(arr > mean_val) / arr.size
    if bright_ratio <= 0.45:
        gray = ImageOps.invert(gray)

    gray = ImageOps.autocontrast(gray, cutoff=2)
    gray = gray.filter(ImageFilter.SHARPEN)
    return gray.convert('RGB')

def sort_chars_by_row(char_boxes):
    """Sắp xếp ký tự: hàng trên trái→phải, hàng dưới trái→phải."""
    if not char_boxes:
        return []
    items = [{'box': b, 'cy': (b[1]+b[3])/2, 'cx': (b[0]+b[2])/2} for b in char_boxes]
    items.sort(key=lambda c: c['cy'])
    if len(items) <= 1:
        return [items[0]['box']]
    gaps = [items[i+1]['cy'] - items[i]['cy'] for i in range(len(items)-1)]
    max_gap_idx = gaps.index(max(gaps))
    row_split = (items[max_gap_idx]['cy'] + items[max_gap_idx+1]['cy']) / 2
    row1 = sorted([c for c in items if c['cy'] <= row_split], key=lambda c: c['cx'])
    row2 = sorted([c for c in items if c['cy'] > row_split], key=lambda c: c['cx'])
    return [c['box'] for c in row1] + [c['box'] for c in row2]


def nms_boxes(boxes: list, iou_threshold: float = 0.3) -> list:
    if len(boxes) <= 1:
        return boxes
    boxes_sorted = sorted(boxes, key=lambda b: (b[2]-b[0])*(b[3]-b[1]), reverse=True)
    keep = []
    for box in boxes_sorted:
        is_dup = False
        for kept in keep:
            ix1, iy1 = max(box[0], kept[0]), max(box[1], kept[1])
            ix2, iy2 = min(box[2], kept[2]), min(box[3], kept[3])
            inter = max(0, ix2-ix1) * max(0, iy2-iy1)
            area_a = (box[2]-box[0]) * (box[3]-box[1])
            area_b = (kept[2]-kept[0]) * (kept[3]-kept[1])
            union = area_a + area_b - inter
            iou = inter / union if union > 0 else 0
            if iou > iou_threshold:
                is_dup = True
                break
        if not is_dup:
            keep.append(box)
    return keep


def draw_plate_results(image: Image.Image, plates: list) -> Image.Image:
    """Vẽ bounding box và nhãn nhận diện lên ảnh."""
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
        
    colors = ['#00FF00', '#FF8C00', '#00FFFF', '#FF00FF', '#FFFF00']
    
    for i, plate in enumerate(plates):
        bbox = plate.get('bbox')
        if not bbox or len(bbox) != 4:
            continue
        x1, y1, x2, y2 = bbox
        text = plate.get('text', '???')
        conf = plate.get('conf', 0.0)
        
        color = colors[i % len(colors)]
        
        # Vẽ viền hình chữ nhật
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        
        # Tạo nhãn
        label = f"{text} ({conf:.0%})"
        
        # Ước tính kích thước chữ
        text_w = len(label) * 6
        text_h = 10
        if font and hasattr(draw, 'textbbox'):
            try:
                l, t, r, b = draw.textbbox((x1, y1 - text_h - 4), label, font=font)
                text_w = r - l
                text_h = b - t
            except Exception:
                pass
                
        draw.rectangle([x1, y1 - text_h - 6, x1 + text_w + 6, y1], fill=color)
        draw.text((x1 + 3, y1 - text_h - 4), label, fill='black', font=font)
        
    return annotated


# ----------------- AI Pipeline Class -----------------

class LPRPipeline:
    def __init__(self):
        s1_path = os.path.join(settings.WEIGHTS_DIR, 'stage1_detector_robust.pt')
        s2_path = os.path.join(settings.WEIGHTS_DIR, 'stage2_char_detector.pt')
        s3_path = os.path.join(settings.WEIGHTS_DIR, 'stage3_char_classify.pt')
        
        # Kiểm tra file weights tồn tại
        for path in [s1_path, s2_path, s3_path]:
            if not os.path.exists(path):
                raise FileNotFoundError(
                    f"Không tìm thấy file weights YOLO tại: {os.path.abspath(path)}. "
                    "Vui lòng đảm bảo các file weights (.pt) đã được đặt đúng trong thư mục weights."
                )

        self.stage1 = YOLO(s1_path)
        self.stage2 = YOLO(s2_path)
        self.stage3 = YOLO(s3_path)

    def run_inference(self, pil_img: Image.Image, conf1: float, conf2: float, conf3: float, imgsz1: int = 1280) -> list:
        """Hàm xử lý lõi nhận diện chuỗi biển số từ PIL Image."""
        det1 = self.stage1.predict(pil_img, imgsz=imgsz1, conf=conf1, verbose=False)[0]
        plates = []
        
        for box in det1.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            c1 = float(box.conf[0])

            plate_crop = pil_img.crop((x1, y1, x2, y2))
            plate_clean = preprocess_plate(plate_crop)

            det2 = self.stage2.predict(plate_clean, imgsz=640, conf=conf2, verbose=False)[0]
            if det2.boxes is None or len(det2.boxes) == 0:
                plates.append({'bbox': [x1, y1, x2, y2], 'text': '???', 'conf': c1})
                continue

            raw_boxes = [tuple(map(int, b.xyxy[0].tolist())) for b in det2.boxes]
            raw_boxes = nms_boxes(raw_boxes, iou_threshold=0.3)
            char_boxes = sort_chars_by_row(raw_boxes)

            plate_text = ''
            for cx1, cy1, cx2, cy2 in char_boxes:
                char_crop = plate_clean.crop((cx1, cy1, cx2, cy2))
                resized = char_crop.resize((64, 64))

                pred3 = self.stage3.predict(resized, imgsz=64, verbose=False)[0]
                
                if hasattr(pred3, 'probs') and pred3.probs is not None:
                    pred_class = pred3.names[pred3.probs.top1]
                    pred_conf = pred3.probs.top1conf.item()
                elif hasattr(pred3, 'boxes') and pred3.boxes is not None and len(pred3.boxes) > 0:
                    pred_class = pred3.names[int(pred3.boxes.cls[0])]
                    pred_conf = float(pred3.boxes.conf[0])
                else:
                    pred_class = '?'
                    pred_conf = 0.0

                if pred_conf >= conf3:
                    plate_text += str(pred_class)
                else:
                    plate_text += '?'

            plates.append({'bbox': [x1, y1, x2, y2], 'text': plate_text, 'conf': c1})
        return plates

# Khởi tạo một thực thể Singleton dùng chung cho toàn bộ app
# Note: Khởi tạo chậm (Lazy initialization) sẽ được thực hiện khi import hoặc chạy app
lpr_service = None

def init_lpr_service():
    global lpr_service
    if lpr_service is None:
        lpr_service = LPRPipeline()
    return lpr_service
