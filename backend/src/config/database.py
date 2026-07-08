# Kết nối PostgreSQL sử dụng SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from src.config.settings import settings

# Khởi tạo engine kết nối
engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True
)

# Khởi tạo session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Định nghĩa Base class cho các Model
Base = declarative_base()

# Helper dependency để lấy DB Session trong API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
