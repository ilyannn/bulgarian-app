import logging
import os
from contextlib import asynccontextmanager
from functools import lru_cache

import uvicorn
from asr import ASRProcessor
from bg_rules import detect_grammar_errors
from config import ConfigError, get_config
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from llm import DummyProvider
from pydantic import BaseModel, Field
from telemetry import get_telemetry, init_telemetry
from tts import TTSProcessor

from content import (
    get_due_mini_lessons,
    get_grammar_item,
    get_mini_lesson,
    get_mini_lessons_for_error,
    load_grammar_pack,
    load_mini_lessons,
    load_scenarios,
)

logger = logging.getLogger(__name__)


# Standard error response model
class ErrorResponse(BaseModel):
    """Standard error response format for API consistency"""

    error: str = Field(..., description="Error type or code")
    message: str = Field(..., description="Human-readable error message")
    details: dict | None = Field(None, description="Additional error details")


# Health check response models
class HealthCheckInfo(BaseModel):
    """Individual health check information"""

    status: str = Field(..., description="Health check status: pass/fail/warn")
    componentType: str = Field(..., description="Type of component being checked")
    observedValue: bool = Field(..., description="Observed value for this check")
    output: str = Field(..., description="Human-readable output message")


class HealthCheckResponse(BaseModel):
    """Health Check Response Format following RFC draft"""

    status: str = Field(..., description="Overall status: pass/fail/warn")
    version: str = Field(..., description="API version")
    serviceId: str = Field(..., description="Service identifier")
    description: str = Field(..., description="Service description")
    checks: dict[str, list[HealthCheckInfo]] = Field(
        ..., description="Individual health checks"
    )


# Global state
grammar_index: dict = {}
scenarios: dict = {}
asr_processor: ASRProcessor | None = None
tts_processor: TTSProcessor | None = None
chat_provider: DummyProvider | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources"""
    global asr_processor, tts_processor, chat_provider, grammar_index, scenarios

    try:
        # Validate environment configuration
        config = get_config()
        logger.info("🚀 Starting Bulgarian Voice Coach server...")

        # Initialize OpenTelemetry instrumentation
        logger.info("Setting up observability...")
        telemetry_context = init_telemetry()
        if telemetry_context:
            logger.info("✅ OpenTelemetry instrumentation enabled")
        else:
            logger.info("ℹ️  OpenTelemetry instrumentation disabled")

        # Initialize processors with optimized configuration
        logger.info("Initializing ASR processor with optimized config...")
        asr_config = {
            "vad_tail_ms": 250,  # Optimized for faster response
            "vad_aggressiveness": 2,
            "beam_size_partial": 1,
            "beam_size_final": 3,  # Balance speed and accuracy
            "no_speech_threshold": 0.6,
            "temperature": 0.0,
        }
        asr_processor = ASRProcessor(asr_config)

        logger.info("Initializing TTS processor...")
        tts_processor = TTSProcessor()

        # Initialize chat provider (dummy for now)
        logger.info(f"Initializing chat provider: {config.chat_provider}")
        chat_provider = DummyProvider()

        # Load content
        logger.info("Loading content system...")
        try:
            grammar_index = load_grammar_pack()
            scenarios = load_scenarios()
            logger.info(
                f"✅ Loaded {len(grammar_index)} grammar items and {len(scenarios)} scenarios"
            )
        except Exception as e:
            logger.error(f"❌ Could not load content: {e}")
            grammar_index = {}
            scenarios = {}

        logger.info("🎉 Server startup complete!")

    except ConfigError as e:
        logger.error(f"❌ Configuration error: {e}")
        logger.error("Please check your environment configuration and try again.")
        raise
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        raise

    yield

    # Cleanup
    logger.info("🔄 Shutting down server...")
    if asr_processor:
        # Add cleanup logic if needed
        pass


class CoachResponse(BaseModel):
    reply_bg: str
    corrections: list[dict]
    contrastive_note: str | None
    drills: list[dict] = []


app = FastAPI(
    title="Bulgarian Voice Coach",
    version="0.1.0",
    description="""Voice-enabled web application for teaching Bulgarian to Slavic speakers with real-time speech recognition, synthesis, and grammar error detection.

**Security Note**: This is a local-first application with no authentication by design. All user progress is stored client-side in localStorage. The API is intentionally open as it runs locally and contains no sensitive data.""",
    lifespan=lifespan,
    contact={
        "name": "Bulgarian Voice Coach Team",
        "email": "support@example.com",
    },
    servers=[
        {"url": "http://localhost:8000", "description": "Development server"},
        {"url": "http://localhost:8001", "description": "Production server"},
    ],
    openapi_tags=[
        {"name": "health", "description": "Health check endpoints"},
        {"name": "tts", "description": "Text-to-speech operations"},
        {"name": "content", "description": "Grammar and scenario content"},
        {"name": "config", "description": "Application configuration"},
        {"name": "websocket", "description": "WebSocket connections"},
    ],
    # Document that this API intentionally has no security schemes
    # This is a local-first app with client-side storage
    components={
        "securitySchemes": {
            "none": {
                "type": "apiKey",
                "in": "header",
                "name": "X-No-Auth",
                "description": "No authentication required - local-first architecture",
            }
        }
    },
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/asr")
async def websocket_asr_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time ASR"""
    telemetry_context = get_telemetry()

    await websocket.accept()

    # Track active connection
    if telemetry_context:
        telemetry_context.update_connections(1)

    if not asr_processor:
        await websocket.close(code=1000, reason="ASR not initialized")
        if telemetry_context:
            telemetry_context.update_connections(-1)
        return

    try:
        while True:
            # Receive binary audio data
            data = await websocket.receive_bytes()

            # Process audio through ASR with telemetry
            if telemetry_context:
                with telemetry_context.trace_operation(
                    "asr_processing", audio_chunk_size=len(data)
                ):
                    import time

                    start_time = time.time()
                    result = asr_processor.process_audio_chunk(data)
                    duration = time.time() - start_time
                    telemetry_context.record_audio_processing(
                        duration, "asr_processing"
                    )
            else:
                result = asr_processor.process_audio_chunk(data)

            if result:
                if result["type"] == "partial":
                    await websocket.send_json(
                        {
                            "type": "partial",
                            "text": result["text"],
                            "confidence": result.get("confidence", 0.7),
                        }
                    )
                elif result["type"] == "final":
                    await websocket.send_json(
                        {
                            "type": "final",
                            "text": result["text"],
                            "confidence": result.get("confidence", 0.85),
                        }
                    )

                    # Track performance metrics
                    import time

                    metrics = {}

                    # Process through chat provider with telemetry
                    if telemetry_context:
                        with telemetry_context.trace_operation(
                            "coaching_pipeline", input_text=result["text"][:100]
                        ):
                            llm_start = time.time()
                            coach_response = await process_user_input(result["text"])
                            metrics["llm_time"] = time.time() - llm_start
                    else:
                        llm_start = time.time()
                        coach_response = await process_user_input(result["text"])
                        metrics["llm_time"] = time.time() - llm_start

                    # Add ASR timing if available
                    if result and "duration" in locals():
                        metrics["asr_time"] = locals()["duration"]

                    await websocket.send_json(
                        {"type": "coach", "payload": coach_response.model_dump()}
                    )

                    # Send performance metrics to client
                    if metrics:
                        await websocket.send_json(
                            {"type": "performance", "metrics": metrics}
                        )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1000, reason=str(e))
    finally:
        # Track connection close
        if telemetry_context:
            telemetry_context.update_connections(-1)


# Cache decorator for common coaching responses
@lru_cache(maxsize=128)
def get_cached_coaching_response(
    text: str, corrections_hash: str
) -> tuple[str, str | None]:
    """
    Cached function for generating coaching responses.
    Returns (reply_bg, contrastive_note) tuple.
    Note: This is a simplified cache key - in production you'd want more sophisticated caching.
    """
    return ("", None)  # Will be overridden by actual logic


async def process_user_input(text: str) -> CoachResponse:
    """Process user input through the coaching pipeline"""

    # Detect grammar errors
    corrections = detect_grammar_errors(text)

    # Get response from chat provider
    system_prompt = """You are a Bulgarian coach for Slavic speakers. Reply ONLY in Bulgarian.
    Provide corrections and a short contrastive note for the user's L1 if provided."""

    if chat_provider is not None:
        telemetry_context = get_telemetry()
        if telemetry_context:
            with telemetry_context.trace_operation(
                "llm_request", input_length=len(text)
            ):
                reply_bg = await chat_provider.get_response(text, system_prompt)
                # Count tokens (rough estimate)
                estimated_tokens = len(text.split()) + len(reply_bg.split())
                telemetry_context.count_llm_tokens(
                    estimated_tokens, "chat_provider", "unknown"
                )
        else:
            reply_bg = await chat_provider.get_response(text, system_prompt)
    else:
        reply_bg = "Съжалявам, няма достъпен чат провайдър."

    # Add drills based on corrections with enhanced logic
    drills = []
    grammar_notes = []

    for correction in corrections:
        error_tag = correction.get("error_tag")
        if error_tag and error_tag in grammar_index:
            grammar_item = grammar_index[error_tag]

            # Add micro-explanation as note if available
            if "micro_explanation_bg" in grammar_item:
                grammar_notes.append(grammar_item["micro_explanation_bg"])

            # Add contextual drills
            if "drills" in grammar_item:
                relevant_drills = list(
                    grammar_item["drills"][:2]
                )  # Up to 2 drills per error
                drills.extend(relevant_drills)

    # Combine grammar notes for contrastive explanation
    contrastive_note = " ".join(set(grammar_notes)) if grammar_notes else None

    return CoachResponse(
        reply_bg=reply_bg,
        corrections=corrections,
        contrastive_note=contrastive_note,
        drills=drills,
    )


# Health check endpoints
@app.get("/", tags=["health"])
async def root():
    """Root endpoint - returns API information"""
    return {
        "name": "Bulgarian Voice Coach API",
        "version": "0.1.0",
        "status": "operational",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get(
    "/health",
    tags=["health"],
    response_model=HealthCheckResponse,
    responses={503: {"model": HealthCheckResponse}},
)
async def health_check():
    """Health check endpoint following Health Check Response Format"""
    # Check service status
    services_status = {
        "asr": asr_processor is not None,
        "tts": tts_processor is not None,
        "llm": chat_provider is not None,
        "content": bool(grammar_index and scenarios),
    }

    all_healthy = all(services_status.values())

    # Follow Health Check Response Format (RFC draft)
    health_response = HealthCheckResponse(
        status="pass" if all_healthy else "fail",
        version="0.1.0",
        serviceId="bulgarian-voice-coach-api",
        description="Bulgarian Voice Coach API health status",
        checks={
            "asr:availability": [
                HealthCheckInfo(
                    status="pass" if services_status["asr"] else "fail",
                    componentType="service",
                    observedValue=services_status["asr"],
                    output="ASR processor initialized"
                    if services_status["asr"]
                    else "ASR not initialized",
                )
            ],
            "tts:availability": [
                HealthCheckInfo(
                    status="pass" if services_status["tts"] else "fail",
                    componentType="service",
                    observedValue=services_status["tts"],
                    output="TTS processor initialized"
                    if services_status["tts"]
                    else "TTS not initialized",
                )
            ],
            "llm:availability": [
                HealthCheckInfo(
                    status="pass" if services_status["llm"] else "fail",
                    componentType="service",
                    observedValue=services_status["llm"],
                    output="LLM provider initialized"
                    if services_status["llm"]
                    else "LLM not initialized",
                )
            ],
            "content:availability": [
                HealthCheckInfo(
                    status="pass" if services_status["content"] else "fail",
                    componentType="datastore",
                    observedValue=services_status["content"],
                    output="Content loaded"
                    if services_status["content"]
                    else "Content not loaded",
                )
            ],
        },
    )

    # Return appropriate status code
    if not all_healthy:
        raise HTTPException(status_code=503, detail=health_response.model_dump())

    return health_response


@app.get("/tts", tags=["tts"], responses={422: {"model": ErrorResponse}})
async def text_to_speech(text: str, track_timing: bool = False):
    """Convert text to speech and stream audio"""
    telemetry_context = get_telemetry()

    if not tts_processor:
        raise HTTPException(status_code=500, detail="TTS not initialized")

    if telemetry_context:
        telemetry_context.count_request("GET", "/tts", 200)

    tts_duration = 0

    def generate_audio():
        nonlocal tts_duration
        assert tts_processor is not None
        if telemetry_context:
            with telemetry_context.trace_operation(
                "tts_synthesis", text_length=len(text)
            ):
                import time

                start_time = time.time()
                yield from tts_processor.synthesize_streaming(text)
                tts_duration = time.time() - start_time
                telemetry_context.record_audio_processing(tts_duration, "tts_synthesis")
        else:
            import time

            start_time = time.time()
            yield from tts_processor.synthesize_streaming(text)
            tts_duration = time.time() - start_time

    headers = {"Cache-Control": "no-cache"}
    if track_timing and tts_duration > 0:
        headers["X-TTS-Duration"] = str(tts_duration)

    return StreamingResponse(generate_audio(), media_type="audio/wav", headers=headers)


@app.get("/content/scenarios", tags=["content"])
async def get_scenarios():
    """Get list of available scenarios"""
    return list(scenarios.values())


@app.get(
    "/content/grammar/{grammar_id}",
    tags=["content"],
    responses={422: {"model": ErrorResponse}},
)
async def get_grammar(grammar_id: str, l1: str | None = None):
    """Get specific grammar item by ID with L1-specific contrast notes"""
    item = get_grammar_item(grammar_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grammar item not found")

    # Create a copy to avoid modifying the original
    result = dict(item)

    # Add L1-specific contrast note
    if l1 and "contrast_notes" in item:
        result["contrast_note"] = item["contrast_notes"].get(l1.upper())
    elif "contrast_notes" in item:
        # Default to config L1 if not specified
        result["contrast_note"] = item["contrast_notes"].get(
            get_config().default_l1_language
        )

    return result


@app.get(
    "/content/drills/{grammar_id}",
    tags=["content"],
    responses={422: {"model": ErrorResponse}},
)
async def get_drills_for_grammar(grammar_id: str, l1: str | None = None):
    """Get drills for a specific grammar item with L1-specific contrast"""
    item = get_grammar_item(grammar_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grammar item not found")

    # Get L1-specific contrast note
    contrast_note = None
    if l1 and "contrast_notes" in item:
        contrast_note = item["contrast_notes"].get(l1.upper())
    elif "contrast_notes" in item:
        contrast_note = item["contrast_notes"].get(get_config().default_l1_language)

    return {
        "grammar_id": grammar_id,
        "drills": item.get("drills", []),
        "examples": item.get("examples", []),
        "explanation": item.get("micro_explanation_bg", ""),
        "contrast_note": contrast_note,
    }


@app.get("/content/mini-lessons", tags=["content"])
async def get_mini_lessons():
    """Get list of available mini-lessons"""
    return list(load_mini_lessons().values())


@app.get(
    "/content/mini-lessons/{lesson_id}",
    tags=["content"],
    responses={422: {"model": ErrorResponse}},
)
async def get_mini_lesson_by_id(lesson_id: str):
    """Get specific mini-lesson by ID"""
    lesson = get_mini_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Mini-lesson not found")

    return lesson


class UserProgress(BaseModel):
    """User progress data for SRS calculation"""

    lesson_progress: dict[str, dict]


@app.post(
    "/content/mini-lessons/due",
    tags=["content"],
    responses={422: {"model": ErrorResponse}},
)
async def get_due_lessons(progress: UserProgress):
    """Get mini-lessons due for review based on user's SRS progress"""
    due_lessons = get_due_mini_lessons(progress.lesson_progress)
    return due_lessons


@app.get(
    "/content/mini-lessons/for-error/{error_pattern}",
    tags=["content"],
    responses={422: {"model": ErrorResponse}},
)
async def get_lessons_for_error(error_pattern: str):
    """Get mini-lessons that match a specific error pattern"""
    lessons = get_mini_lessons_for_error(error_pattern)
    return lessons


@app.get("/api/config", tags=["config"])
async def get_app_config():
    """Get current application configuration for frontend"""
    return {
        "l1_language": get_config().default_l1_language,
        "supported_languages": ["PL", "RU", "UK", "SR"],
        "language_names": {
            "PL": "Polski (Polish)",
            "RU": "Русский (Russian)",
            "UK": "Українська (Ukrainian)",
            "SR": "Српски (Serbian)",
        },
    }


@app.post("/api/config/l1", tags=["config"], responses={422: {"model": ErrorResponse}})
async def update_l1_language(request: dict):
    """Update L1 language preference (session-based, not persistent)"""
    new_l1 = request.get("l1_language", "").upper()
    if new_l1 not in ["PL", "RU", "UK", "SR"]:
        raise HTTPException(
            status_code=400, detail="Invalid L1 language. Use PL, RU, UK, or SR"
        )

    # Note: This is session-based. For persistence, we'd need user auth
    # For now, return the validated language for frontend to store in localStorage
    return {"l1_language": new_l1, "status": "updated"}


@app.post(
    "/content/analyze", tags=["content"], responses={422: {"model": ErrorResponse}}
)
async def analyze_text(request: dict):
    """Analyze Bulgarian text for grammar errors and generate drills with L1 contrast"""
    text = request.get("text", "")
    l1 = request.get("l1", get_config().default_l1_language)

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    # Detect grammar errors
    corrections = detect_grammar_errors(text)

    # Generate drill suggestions with L1-specific contrast
    drill_suggestions = []
    for correction in corrections:
        error_tag = correction.get("error_tag")
        if error_tag and error_tag in grammar_index:
            grammar_item = grammar_index[error_tag]

            # Get L1-specific contrast note
            contrast_note = None
            if "contrast_notes" in grammar_item:
                contrast_note = grammar_item["contrast_notes"].get(
                    l1.upper(),
                    grammar_item["contrast_notes"].get(
                        get_config().default_l1_language
                    ),
                )

            drill_suggestions.append(
                {
                    "grammar_id": error_tag,
                    "explanation": grammar_item.get("micro_explanation_bg", ""),
                    "contrast_note": contrast_note,
                    "drills": grammar_item.get("drills", [])[:2],  # Limit to 2 drills
                }
            )

    return {
        "text": text,
        "corrections": corrections,
        "drill_suggestions": drill_suggestions,
        "l1_language": l1,
    }


# Serve static files in production
if os.path.exists("../client/dist"):
    app.mount("/", StaticFiles(directory="../client/dist", html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
