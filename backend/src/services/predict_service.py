import os
import cv2
import shutil
import tempfile
import numpy as np
import uuid
import threading
import time
import base64
import asyncio
from datetime import datetime
from PIL import Image
from fastapi import UploadFile, BackgroundTasks, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session

from src.config.settings import settings
from src.config.database import SessionLocal
from src.models import models, schemas
from src.services.ai_pipeline import init_lpr_service, draw_plate_results
from src.utils.helpers import save_snapshot_image, cleanup_file, is_similar_plate, log_activity

# Lưu trữ trạng thái video task cũ dùng UUID
tasks_db = {}

def process_video_background(job_id: int, input_path: str, output_path: str, filename: str, user_id: int | None = None, region_id: int | None = None):
    """Hàm xử lý video chạy ngầm trong luồng riêng biệt, cập nhật trực tiếp vào DB."""
    cap = None
    writer = None
    try:
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise Exception("Không thể mở file video đầu vào.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        file_size = os.path.getsize(input_path) if os.path.exists(input_path) else 0
        duration = total_frames / fps if fps > 0 else 0.0

        # Cập nhật thông tin ban đầu của video vào database
        with SessionLocal() as db:
            job = db.query(models.VideoJob).filter(models.VideoJob.id == job_id).first()
            if job:
                job.status = "processing"
                job.total_frames = total_frames
                job.fps = fps
                job.duration = duration
                job.file_size = file_size
                db.commit()

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not writer.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            if not writer.isOpened():
                raise Exception("Không khởi tạo được VideoWriter.")

        font = cv2.FONT_HERSHEY_SIMPLEX
        frame_idx = 0
        start_time = time.time()
        
        service = init_lpr_service()
        video_active_plates = {}

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)

            plates = service.run_inference(
                pil_img, settings.CONF_S1_VID, settings.CONF_S2_VID, settings.CONF_S3_VID
            )

            now_ms = frame_idx * (1000.0 / fps)
            for plate in plates:
                x1, y1, x2, y2 = plate['bbox']
                plate_text = plate['text']
                conf = plate.get('conf', 0.0)
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, plate_text, (x1, y1 - 10), font, 0.8, (0, 255, 0), 2)

                if not plate_text or plate_text == "???" or "?" in plate_text:
                    continue
                clean_text = plate_text.replace("-", "").replace(".", "").replace(" ", "")
                if len(clean_text) < 8:
                    continue
                
                is_duplicate = False
                for active_text, last_seen_ms in list(video_active_plates.items()):
                    if is_similar_plate(plate_text, active_text):
                        video_active_plates[active_text] = now_ms
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    annotated_img = draw_plate_results(pil_img, [plate])
                    snapshot_rel_path = save_snapshot_image(annotated_img)
                    
                    with SessionLocal() as db:
                        db_item = models.Detection(
                            plate_text=plate_text,
                            plate_confidence=conf,
                            image_path=snapshot_rel_path,
                            source_type="video",
                            video_job_id=job_id,
                            user_id=user_id,
                            region_id=region_id
                        )
                        db.add(db_item)
                        db.commit()
                        
                    video_active_plates[plate_text] = now_ms

            for active_text, last_seen_ms in list(video_active_plates.items()):
                if now_ms - last_seen_ms > 5000:
                    video_active_plates.pop(active_text, None)

            writer.write(frame)
            frame_idx += 1

            if frame_idx % 5 == 0 or frame_idx == total_frames:
                elapsed = time.time() - start_time
                speed = frame_idx / elapsed if elapsed > 0 else 0.0
                pct = int((frame_idx / total_frames) * 100) if total_frames > 0 else 0
                
                with SessionLocal() as db:
                    job = db.query(models.VideoJob).filter(models.VideoJob.id == job_id).first()
                    if job:
                        job.progress = pct
                        job.fps = round(speed, 1)
                        db.commit()

        cap.release()
        writer.release()
        cleanup_file(input_path)
        
        with SessionLocal() as db:
            job = db.query(models.VideoJob).filter(models.VideoJob.id == job_id).first()
            if job:
                job.status = "completed"
                job.progress = 100
                job.completed_at = datetime.utcnow()
                job.output_video = output_path
                db.commit()

    except Exception as e:
        if cap:
            cap.release()
        if writer:
            writer.release()
        cleanup_file(input_path)
        cleanup_file(output_path)
        
        with SessionLocal() as db:
            job = db.query(models.VideoJob).filter(models.VideoJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                db.commit()


class PredictService:
    @staticmethod
    async def predict_image(file: UploadFile, user_id: int | None, region_id: int | None, db: Session):
        ext = os.path.splitext(file.filename)[1].lower()
        if not file.content_type.startswith("image/") and ext not in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
            raise HTTPException(status_code=400, detail="File tải lên không phải là ảnh hợp lệ.")
        
        try:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img_bgr is None:
                raise HTTPException(status_code=400, detail="Không thể giải mã file ảnh.")
                
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_rgb)
            
            service = init_lpr_service()
            results = service.run_inference(
                pil_img, settings.CONF_S1_IMG, settings.CONF_S2_IMG, settings.CONF_S3_IMG
            )
            
            # Vẽ kết quả vẽ bounding box làm snapshot
            annotated_img = draw_plate_results(pil_img, results)
            snapshot_rel_path = save_snapshot_image(annotated_img)
            
            # Nếu không có region_id, thử lấy phân vùng mặc định đầu tiên
            if not region_id:
                first_reg = db.query(models.Region).first()
                if first_reg:
                    region_id = first_reg.id

            # Lưu kết quả nhận diện của ảnh vào Database
            for plate in results:
                text = plate["text"]
                conf = plate["conf"]
                if text and text != "???":
                    db_detection = models.Detection(
                        plate_text=text,
                        plate_confidence=conf,
                        image_path=snapshot_rel_path,
                        source_type="image",
                        user_id=user_id,
                        region_id=region_id
                    )
                    db.add(db_detection)
            db.commit()
            
            return {
                "status": "success",
                "results": results,
                "annotated_image": snapshot_rel_path
            }
        except HTTPException as he:
            raise he
        except Exception as e:
            return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

    @staticmethod
    async def predict_video(file: UploadFile, user_id: int | None, region_id: int | None, db: Session):
        ext = os.path.splitext(file.filename)[1].lower()
        if not file.content_type.startswith("video/") and ext not in ['.mp4', '.avi', '.mov', '.mkv']:
            raise HTTPException(status_code=400, detail="File tải lên không phải là video hợp lệ.")

        temp_dir = tempfile.gettempdir()
        task_uuid = str(uuid.uuid4())
        
        input_path = os.path.join(temp_dir, f"{task_uuid}_in{ext}")
        output_path = os.path.join(temp_dir, f"{task_uuid}_out.mp4")
        
        try:
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            file_size = os.path.getsize(input_path) if os.path.exists(input_path) else 0

            # Nếu không có region_id, thử lấy phân vùng mặc định đầu tiên
            if not region_id:
                first_reg = db.query(models.Region).first()
                if first_reg:
                    region_id = first_reg.id

            # Tạo bản ghi Job Video vào database
            db_job = models.VideoJob(
                user_id=user_id,
                filename=file.filename,
                file_path=input_path,
                file_size=file_size,
                status="pending",
                progress=0,
                created_at=datetime.utcnow()
            )
            db.add(db_job)
            db.commit()
            db.refresh(db_job)
            
            job_id = db_job.id
            
            # Chạy luồng nền để xử lý video
            thread = threading.Thread(
                target=process_video_background,
                args=(job_id, input_path, output_path, file.filename, user_id, region_id)
            )
            thread.daemon = True
            thread.start()
            
            log_activity(db, user_id, "Tải lên video", f"Khởi chạy tiến trình xử lý video '{file.filename}' (Job #{job_id}).")
            
            return {
                "status": "success",
                "task_id": str(job_id),
                "message": "Bắt đầu xử lý video."
            }
        except Exception as e:
            cleanup_file(input_path)
            cleanup_file(output_path)
            return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

    @staticmethod
    async def get_task_status(task_id: str, db: Session):
        # Thử tìm kiếm trong database trước
        try:
            job_id = int(task_id)
            job = db.query(models.VideoJob).filter(models.VideoJob.id == job_id).first()
            if job:
                return {
                    "task_id": str(job.id),
                    "status": job.status,
                    "progress": job.progress or 0,
                    "fps": job.fps or 0.0,
                    "current_frame": int(((job.progress or 0) / 100.0) * job.total_frames) if (job.progress and job.total_frames) else 0,
                    "total_frames": job.total_frames or 0,
                    "error": job.error_message
                }
        except ValueError:
            pass

        # Phục hồi tìm trong tasks_db trong bộ nhớ (dành cho các task cũ dùng UUID)
        if task_id not in tasks_db:
            raise HTTPException(status_code=404, detail="Không tìm thấy task ID.")
        task_info = tasks_db[task_id]
        return {
            "task_id": task_id,
            "status": task_info["status"],
            "progress": task_info["progress"],
            "fps": task_info["fps"],
            "current_frame": task_info["current_frame"],
            "total_frames": task_info["total_frames"],
            "error": task_info["error"]
        }

    @staticmethod
    async def download_task_result(task_id: str, background_tasks: BackgroundTasks, db: Session):
        # Thử tìm kiếm trong database trước
        try:
            job_id = int(task_id)
            job = db.query(models.VideoJob).filter(models.VideoJob.id == job_id).first()
            if job:
                if job.status == "processing":
                    raise HTTPException(status_code=400, detail="Video đang xử lý.")
                elif job.status == "failed":
                    raise HTTPException(status_code=400, detail=f"Xử lý video thất bại: {job.error_message}")
                    
                output_path = job.output_video
                if not output_path or not os.path.exists(output_path):
                    raise HTTPException(status_code=404, detail="File video kết quả không tồn tại.")
                    
                response = FileResponse(
                    output_path, 
                    media_type="video/mp4", 
                    filename=f"processed_{job.filename}"
                )
                
                # Đăng ký tác vụ dọn dẹp file sau khi tải
                background_tasks.add_task(cleanup_file, output_path)
                return response
        except ValueError:
            pass

        # Phục hồi từ tasks_db cũ dùng UUID
        if task_id not in tasks_db:
            raise HTTPException(status_code=404, detail="Không tìm thấy task ID.")
            
        task_info = tasks_db[task_id]
        if task_info["status"] == "processing":
            raise HTTPException(status_code=400, detail="Video đang xử lý.")
        elif task_info["status"] == "failed":
            raise HTTPException(status_code=400, detail=f"Xử lý video thất bại: {task_info['error']}")
            
        output_path = task_info["output_file"]
        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="File không tồn tại.")
            
        response = FileResponse(
            output_path, 
            media_type="video/mp4", 
            filename=f"processed_{task_info['filename']}"
        )
        
        background_tasks.add_task(cleanup_file, output_path)
        background_tasks.add_task(lambda: tasks_db.pop(task_id, None))
        return response

    @staticmethod
    async def handle_websocket(websocket: WebSocket):
        """WebSocket xử lý nhận diện biển số thời gian thực từ webcam."""
        await websocket.accept()
        # Để tránh ghi nhận trùng lặp liên tục trong cùng 1 kết nối
        active_plates = {}
        
        try:
            while True:
                data = await websocket.receive_json()
                image_data = data.get("image")
                if not image_data:
                    await websocket.send_json({"status": "error", "message": "Thiếu dữ liệu ảnh."})
                    continue
                    
                conf1 = float(data.get("conf1", settings.CONF_S1_IMG))
                conf2 = float(data.get("conf2", settings.CONF_S2_IMG))
                conf3 = float(data.get("conf3", settings.CONF_S3_IMG))

                try:
                    user_id = int(data.get("user_id")) if data.get("user_id") is not None else None
                except (ValueError, TypeError):
                    user_id = None

                try:
                    region_id = int(data.get("region_id")) if data.get("region_id") is not None else None
                except (ValueError, TypeError):
                    region_id = None

                if "," in image_data:
                    image_data = image_data.split(",")[1]
                
                img_bytes = base64.b64decode(image_data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img_bgr is None:
                    await websocket.send_json({"status": "error", "message": "Không thể giải mã ảnh."})
                    continue
                    
                img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(img_rgb)
                
                service = init_lpr_service()
                results = await asyncio.to_thread(
                    service.run_inference, pil_img, conf1, conf2, conf3, 640
                )
                
                # Ghi nhận phát hiện mới vào database PostgreSQL
                now = time.time()
                for plate in results:
                    text = plate["text"]
                    conf = plate["conf"]
                    if not text or text == "???" or "?" in text:
                        continue
                        
                    clean_text = text.replace("-", "").replace(".", "").replace(" ", "")
                    if len(clean_text) < 8:
                        continue
                    
                    # Check trùng lặp
                    is_duplicate = False
                    for active_text, last_seen in list(active_plates.items()):
                        if is_similar_plate(text, active_text):
                            active_plates[active_text] = now
                            is_duplicate = True
                            break
                    
                    if not is_duplicate:
                        # Vẽ bounding box lên ảnh làm snapshot lưu trữ
                        annotated_img = draw_plate_results(pil_img, [plate])
                        snapshot_rel_path = save_snapshot_image(annotated_img)
                        
                        # Lưu vào db sử dụng SessionLocal cục bộ để tránh rò rỉ session
                        with SessionLocal() as db:
                            # Nếu không có region_id, thử lấy phân vùng mặc định đầu tiên
                            actual_region_id = region_id
                            if not actual_region_id:
                                first_reg = db.query(models.Region).first()
                                if first_reg:
                                    actual_region_id = first_reg.id

                            db_item = models.Detection(
                                plate_text=text,
                                plate_confidence=conf,
                                image_path=snapshot_rel_path,
                                source_type="camera",
                                user_id=user_id,
                                region_id=actual_region_id
                            )
                            db.add(db_item)
                            db.commit()
                        
                        active_plates[text] = now
                
                # Quét dọn biển số hoạt động đã quá 2.5s không thấy
                for active_text, last_seen in list(active_plates.items()):
                    if now - last_seen > 2.5:
                        active_plates.pop(active_text, None)
                        
                await websocket.send_json({
                    "status": "success",
                    "results": results
                })
                
        except WebSocketDisconnect:
            pass
        except Exception as e:
            try:
                await websocket.send_json({"status": "error", "message": str(e)})
            except Exception:
                pass
