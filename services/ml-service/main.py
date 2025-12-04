"""
Main FastAPI application for ML Service (minimal)
"""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from services.ml_service import MLService
from controllers.ml_controller import setup_routes

# Load .env if available (optional)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# Configure logging (level from env LOG_LEVEL)
log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Disable uvicorn access log
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)

# Global services
ml_service_instance = None
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for startup and shutdown"""
    global ml_service_instance
    
    # Startup
    logger.info("Starting ML Service...")
    
    try:
        # Initialize ML service
        ml_service_instance = MLService()
        app_state['ml_service'] = ml_service_instance

        # Setup routes
        router = setup_routes(ml_service_instance)
        app.include_router(router)

        logger.info("✅ ML Service initialized")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Service...")

# Create FastAPI app
app = FastAPI(
    title="ML Service",
    description="Machine Learning Service for Danger Prediction and Early Warning",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint - MUST be defined early and always return 200
@app.get("/health")
def health_check():
    """Health check endpoint - must return 200 OK immediately"""
    # Always return healthy - service is running if this endpoint is accessible
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
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

