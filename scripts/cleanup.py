import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Import model
from src.models.models import Detection

def cleanup_missing_images():
    db = SessionLocal()
    try:
        detections = db.query(Detection).filter(Detection.image_path.isnot(None)).all()
        updated_count = 0
        for detection in detections:
            # image_path usually looks like '/static/snapshots/xyz.jpg'
            # We need to check if the file exists locally. 
            # The local path is relative to the backend folder: '.' + image_path
            if detection.image_path.startswith("/static/"):
                local_path = "." + detection.image_path
                if not os.path.exists(local_path):
                    print(f"File not found: {local_path}. Setting image_path to None for detection {detection.id}")
                    detection.image_path = None
                    updated_count += 1
        
        db.commit()
        print(f"Cleanup complete. Updated {updated_count} records.")
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_missing_images()
