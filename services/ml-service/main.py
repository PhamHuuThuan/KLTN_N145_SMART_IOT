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
from consumers.sensor_consumer import SensorConsumer

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

# Global services
ml_service_instance = None
consumer_instance = None
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for startup and shutdown"""
    global ml_service_instance, consumer_instance
    
    # Startup
    logger.info("🚀 Starting ML Service...")
    
    try:
        # Initialize ML service
        ml_service_instance = MLService()
        app_state['ml_service'] = ml_service_instance

        # Setup routes
        router = setup_routes(ml_service_instance)
        app.include_router(router)

        logger.info("✅ ML Service initialized - FastAPI ready to accept requests")
        
        # Optionally start Kafka consumer (non-blocking, can start after uvicorn is ready)
        kafka_enabled = os.getenv("KAFKA_ENABLED", "false").lower() == "true"
        if kafka_enabled:
            # Start Kafka consumer in background (don't block uvicorn startup)
            import asyncio
            async def start_kafka_consumer():
                try:
                    consumer_instance = SensorConsumer(ml_service_instance)
                    await consumer_instance.start()
                    brokers = os.getenv("KAFKA_BROKERS", "localhost:29092")
                    topics = os.getenv("KAFKA_TOPICS", "iot.telemetry.logs,iot.events.logs")
                    logger.info(f"✅ Kafka consumer enabled. Brokers={brokers}, Topics={topics}")
                except Exception as kafka_err:
                    logger.error(f"Kafka consumer startup error: {kafka_err}")
            
            # Start Kafka consumer as background task
            asyncio.create_task(start_kafka_consumer())
        else:
            logger.info("Kafka consumer disabled. Set KAFKA_ENABLED=true to enable.")

        logger.info("✅ ML Service started successfully (minimal)")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down ML Service...")
    if consumer_instance:
        await consumer_instance.stop()
    logger.info("✅ ML Service shut down")

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

# app_state already defined at top

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
            "train": "/api/ml/train",
            "status": "/api/ml/status",
            "predict_from_event": "/api/ml/predict/event"
            
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3007"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

