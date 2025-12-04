"""Main FastAPI application for ML Service."""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from services.ml_service import MLService
from controllers.ml_controller import setup_routes

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)

ml_service_instance = None
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for startup and shutdown."""
    global ml_service_instance
    
    logger.info("Starting ML Service...")
    
    try:
        ml_service_instance = MLService()
        app_state['ml_service'] = ml_service_instance
        router = setup_routes(ml_service_instance)
        app.include_router(router)
        logger.info("ML Service initialized")
    except Exception as e:
        logger.error(f"Error during startup: {e}")
    
    yield
    
    logger.info("Shutting down ML Service...")

app = FastAPI(
    title="ML Service",
    description="Machine Learning Service for Danger Prediction and Early Warning",
    version="1.0.0",
    lifespan=lifespan
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "ML Service",
        "description": "Machine Learning Service for Smart IoT",
        "version": "1.0.0",
        "endpoints": {
            "predict": "/api/ml/predict",
            "predict_batch": "/api/ml/predict/batch",
            "status": "/api/ml/status",
            "predict_from_event": "/api/ml/predict/event",
            "predict_from_event_aggregate": "/api/ml/predict/event/aggregate"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3007"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, access_log=False, log_level="warning")

