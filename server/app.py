import logging
import os
from contextlib import asynccontextmanager
from datetime import UTC
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


# Health check response models (RFC Health Check Response Format)
class HealthCheckItem(BaseModel):
    """Individual health check item (RFC compliant)"""

    status: str = Field(..., description="Check status: pass/fail/warn")
    componentType: str | None = Field(
        None, description="Type of component being checked"
    )
    observedValue: bool | str | None = Field(
        None, description="Observed value for this check"
    )
    observedUnit: str | None = Field(None, description="Unit of observed value")
    output: str | None = Field(None, description="Human-readable output message")
    time: str | None = Field(None, description="RFC 3339 timestamp")


class HealthCheckResponse(BaseModel):
    """Health Check Response Format following RFC draft"""

    status: str = Field(..., description="Overall status: pass/fail/warn")
    version: str | None = Field(None, description="Public version of the service")
    releaseId: str | None = Field(None, description="Internal release identifier")
    serviceId: str | None = Field(None, description="Unique service identifier")
    description: str | None = Field(None, description="Human-friendly description")
    checks: dict[str, HealthCheckItem] | None = Field(
        None, description="Individual health checks"
    )
    output: str | None = Field(
        None, description="Raw error output for warn/fail states"
    )
    notes: list[str] | None = Field(
        None, description="Array of notes relevant to health"
    )
    links: dict[str, str] | None = Field(
        None, description="Links with more health information"
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


# Request/Response models for API endpoints
class UpdateL1Request(BaseModel):
    """Request to update L1 language preference"""

    l1_language: str = Field(
        ..., description="L1 language code (PL, RU, UK, SR)", pattern="^(PL|RU|UK|SR)$"
    )


class UpdateL1Response(BaseModel):
    """Response after updating L1 language preference"""

    l1_language: str = Field(..., description="Validated L1 language code")
    status: str = Field(..., description="Update status")


class AnalyzeTextRequest(BaseModel):
    """Request to analyze Bulgarian text for grammar errors"""

    text: str = Field(..., description="Bulgarian text to analyze", min_length=1)
    l1: str | None = Field(
        None, description="L1 language code for contrasts", pattern="^(PL|RU|UK|SR)$"
    )


class GrammarCorrection(BaseModel):
    """Individual grammar correction"""

    type: str = Field(..., description="Type of grammar error")
    before: str = Field(..., description="Original incorrect text")
    after: str = Field(..., description="Corrected text")
    note: str = Field(..., description="Explanation of the correction")
    error_tag: str = Field(..., description="Grammar rule identifier")


class DrillSuggestion(BaseModel):
    """Grammar drill suggestion with L1 contrast"""

    grammar_id: str = Field(..., description="Grammar rule identifier")
    explanation: str = Field(..., description="Micro-explanation in Bulgarian")
    contrast_note: str | None = Field(None, description="L1-specific contrast note")
    drills: list[dict] = Field(
        ..., description="Practice drills for this grammar point"
    )


class AnalyzeTextResponse(BaseModel):
    """Response from text analysis with corrections and drill suggestions"""

    text: str = Field(..., description="Original text that was analyzed")
    corrections: list[GrammarCorrection] = Field(
        ..., description="Grammar corrections found"
    )
    drill_suggestions: list[DrillSuggestion] = Field(
        ..., description="Suggested practice drills"
    )
    l1_language: str = Field(..., description="L1 language used for contrasts")


class AppConfigResponse(BaseModel):
    """Application configuration response"""

    l1_language: str = Field(..., description="Default L1 language")
    supported_languages: list[str] = Field(
        ..., description="Supported L1 language codes"
    )
    language_names: dict[str, str] = Field(
        ..., description="Language code to display name mapping"
    )


class UserProgress(BaseModel):
    """User progress data for SRS calculation"""

    lesson_progress: dict[str, dict] = Field(..., description="Lesson progress mapping")


# WebSocket message models
class ASRPartialResult(BaseModel):
    """Partial ASR transcription result"""

    type: str = Field(..., description="Message type", example="partial")
    text: str = Field(..., description="Partial transcription text")
    confidence: float | None = Field(None, description="Confidence score")


class ASRFinalResult(BaseModel):
    """Final ASR transcription result"""

    type: str = Field(..., description="Message type", example="final")
    text: str = Field(..., description="Final transcription text")
    confidence: float | None = Field(None, description="Confidence score")
    duration_ms: int | None = Field(
        None, description="Processing duration in milliseconds"
    )


class ASRErrorResult(BaseModel):
    """ASR processing error"""

    type: str = Field(..., description="Message type", example="error")
    error: str = Field(..., description="Error message")


class TTSProfilesResponse(BaseModel):
    """Available TTS voice profiles"""

    profiles: dict[str, dict] = Field(
        ..., description="Voice profiles with their configurations"
    )


# Pronunciation scoring models
class PronunciationRequest(BaseModel):
    """Request for pronunciation analysis"""

    audio_data: str = Field(..., description="Base64 encoded audio data (16kHz, mono)")
    reference_text: str = Field(..., description="Expected text for comparison")
    sample_rate: int = Field(16000, description="Audio sample rate")


class PhonemeScore(BaseModel):
    """Phoneme-level pronunciation score"""

    phoneme: str = Field(..., description="Phoneme symbol")
    score: float = Field(..., description="Pronunciation score (0.0-1.0)")
    difficulty: int = Field(..., description="Phoneme difficulty level (1-4)")
    start_time: float = Field(..., description="Start time in seconds")
    end_time: float = Field(..., description="End time in seconds")
    ipa: str = Field(..., description="IPA representation")


class WordScore(BaseModel):
    """Word-level pronunciation score"""

    word: str = Field(..., description="The word")
    score: float = Field(..., description="Overall word score (0.0-1.0)")
    start_time: float = Field(..., description="Start time in seconds")
    end_time: float = Field(..., description="End time in seconds")
    phonemes: list[PhonemeScore] = Field(..., description="Phoneme-level scores")
    problem_phonemes: list[str] = Field(..., description="Problematic phonemes")
    difficulty: int = Field(..., description="Overall word difficulty")


class VisualFeedback(BaseModel):
    """Visual feedback data for pronunciation display"""

    timeline: list[dict] = Field(..., description="Timeline visualization data")
    phoneme_heatmap: dict[str, dict] = Field(
        ..., description="Phoneme difficulty heatmap"
    )
    audio_length: float = Field(..., description="Total audio length in seconds")


class PronunciationAnalysis(BaseModel):
    """Complete pronunciation analysis results"""

    overall_score: float = Field(
        ..., description="Overall pronunciation score (0.0-1.0)"
    )
    word_scores: list[WordScore] = Field(
        ..., description="Per-word pronunciation scores"
    )
    phoneme_scores: list[PhonemeScore] = Field(..., description="Per-phoneme scores")
    problem_phonemes: list[str] = Field(
        ..., description="Problematic phonemes identified"
    )
    transcribed_text: str = Field(..., description="What was actually transcribed")
    reference_text: str = Field(..., description="Expected reference text")
    visual_feedback: VisualFeedback = Field(
        ..., description="Data for visual components"
    )
    suggestions: list[str] = Field(..., description="Improvement suggestions")
    confidence: float = Field(..., description="Analysis confidence level")


class PracticeWordsRequest(BaseModel):
    """Request for practice words for a specific phoneme"""

    phoneme: str = Field(..., description="Target phoneme to practice")
    difficulty_level: int = Field(1, ge=1, le=4, description="Difficulty level (1-4)")


class PracticeWordsResponse(BaseModel):
    """Practice words for phoneme training"""

    phoneme: str = Field(..., description="Target phoneme")
    practice_words: list[str] = Field(..., description="Recommended practice words")
    difficulty_level: int = Field(..., description="Requested difficulty level")


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
        {"name": "pronunciation", "description": "Pronunciation analysis and feedback"},
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
    responses={
        200: {
            "model": HealthCheckResponse,
            "content": {"application/health+json": {"example": {"status": "pass"}}},
            "description": "Service is healthy",
        },
        503: {
            "model": HealthCheckResponse,
            "content": {"application/health+json": {"example": {"status": "fail"}}},
            "description": "Service is unhealthy",
        },
    },
)
async def health_check():
    """Health check endpoint following RFC Health Check Response Format

    Returns health status in application/health+json format according to
    the Health Check Response Format for HTTP APIs RFC draft.
    """
    from datetime import datetime

    # Check service status
    services_status = {
        "asr": asr_processor is not None,
        "tts": tts_processor is not None,
        "llm": chat_provider is not None,
        "content": bool(grammar_index and scenarios),
    }

    all_healthy = all(services_status.values())
    current_time = datetime.now(UTC).isoformat()

    # Build RFC-compliant health checks
    checks = {
        "asr:availability": HealthCheckItem(
            status="pass" if services_status["asr"] else "fail",
            componentType="service",
            observedValue=services_status["asr"],
            output="ASR processor initialized"
            if services_status["asr"]
            else "ASR not initialized",
            time=current_time,
        ),
        "tts:availability": HealthCheckItem(
            status="pass" if services_status["tts"] else "fail",
            componentType="service",
            observedValue=services_status["tts"],
            output="TTS processor initialized"
            if services_status["tts"]
            else "TTS not initialized",
            time=current_time,
        ),
        "llm:availability": HealthCheckItem(
            status="pass" if services_status["llm"] else "fail",
            componentType="service",
            observedValue=services_status["llm"],
            output="LLM provider initialized"
            if services_status["llm"]
            else "LLM not initialized",
            time=current_time,
        ),
        "content:availability": HealthCheckItem(
            status="pass" if services_status["content"] else "fail",
            componentType="datastore",
            observedValue=services_status["content"],
            output="Content loaded"
            if services_status["content"]
            else "Content not loaded",
            time=current_time,
        ),
    }

    # Build overall health response
    health_response = HealthCheckResponse(
        status="pass" if all_healthy else "fail",
        version="0.1.0",
        serviceId="bulgarian-voice-coach-api",
        description="Bulgarian Voice Coach - AI Language Learning API",
        checks=checks,
        links={"self": "/health", "about": "/", "docs": "/docs"},
    )

    # Return appropriate status code according to RFC
    if not all_healthy:
        raise HTTPException(
            status_code=503,
            detail=health_response.model_dump(),
            headers={"Content-Type": "application/health+json"},
        )

    # Return successful response with proper media type
    from fastapi.responses import JSONResponse

    return JSONResponse(
        content=health_response.model_dump(exclude_none=True),
        status_code=200,
        media_type="application/health+json",
    )


@app.get("/tts", tags=["tts"], responses={422: {"model": ErrorResponse}})
async def text_to_speech(
    text: str, track_timing: bool = False, profile: str | None = None
):
    """Convert text to speech and stream audio with optional voice profile"""
    telemetry_context = get_telemetry()

    if not tts_processor:
        raise HTTPException(status_code=500, detail="TTS not initialized")

    # Set voice profile if requested
    if profile and not tts_processor.set_profile(profile):
        raise HTTPException(status_code=400, detail=f"Invalid voice profile: {profile}")

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


@app.get("/tts/profiles", tags=["tts"], response_model=TTSProfilesResponse)
async def get_tts_profiles():
    """Get available TTS voice profiles"""
    if not tts_processor:
        raise HTTPException(status_code=500, detail="TTS not initialized")

    return TTSProfilesResponse(
        profiles={
            "current_profile": tts_processor.get_current_profile(),
            "available_profiles": tts_processor.get_available_profiles(),
        }
    )


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


@app.get("/api/config", tags=["config"], response_model=AppConfigResponse)
async def get_app_config():
    """Get current application configuration for frontend"""
    return AppConfigResponse(
        l1_language=get_config().default_l1_language,
        supported_languages=["PL", "RU", "UK", "SR"],
        language_names={
            "PL": "Polski (Polish)",
            "RU": "Русский (Russian)",
            "UK": "Українська (Ukrainian)",
            "SR": "Српски (Serbian)",
        },
    )


@app.post(
    "/api/config/l1",
    tags=["config"],
    response_model=UpdateL1Response,
    responses={422: {"model": ErrorResponse}},
)
async def update_l1_language(request: UpdateL1Request):
    """Update L1 language preference (session-based, not persistent)"""
    new_l1 = request.l1_language.upper()

    # Note: This is session-based. For persistence, we'd need user auth
    # For now, return the validated language for frontend to store in localStorage
    return UpdateL1Response(l1_language=new_l1, status="updated")


@app.post(
    "/content/analyze",
    tags=["content"],
    response_model=AnalyzeTextResponse,
    responses={422: {"model": ErrorResponse}},
)
async def analyze_text(request: AnalyzeTextRequest):
    """Analyze Bulgarian text for grammar errors and generate drills with L1 contrast"""
    text = request.text
    l1 = request.l1 or get_config().default_l1_language

    # Detect grammar errors
    raw_corrections = detect_grammar_errors(text)

    # Convert to structured corrections
    corrections = [
        GrammarCorrection(
            type=correction.get("type", "grammar"),
            before=correction.get("before", ""),
            after=correction.get("after", ""),
            note=correction.get("note", ""),
            error_tag=correction.get("error_tag", ""),
        )
        for correction in raw_corrections
    ]

    # Generate drill suggestions with L1-specific contrast
    drill_suggestions = []
    for correction in raw_corrections:
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
                DrillSuggestion(
                    grammar_id=error_tag,
                    explanation=grammar_item.get("micro_explanation_bg", ""),
                    contrast_note=contrast_note,
                    drills=grammar_item.get("drills", [])[:2],  # Limit to 2 drills
                )
            )

    return AnalyzeTextResponse(
        text=text,
        corrections=corrections,
        drill_suggestions=drill_suggestions,
        l1_language=l1,
    )


# Pronunciation scoring endpoints
@app.post(
    "/pronunciation/analyze",
    tags=["pronunciation"],
    response_model=PronunciationAnalysis,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def analyze_pronunciation(request: PronunciationRequest):
    """
    Analyze pronunciation quality of audio against reference text.

    This endpoint provides phoneme-level pronunciation assessment using WhisperX
    for word-level timestamps and phoneme alignment. Returns detailed scoring
    with visual feedback data for the frontend.
    """
    if not asr_processor.is_pronunciation_scoring_enabled():
        raise HTTPException(
            status_code=503,
            detail="Pronunciation scoring is not enabled. Please enable it in configuration.",
        )

    try:
        import base64

        import numpy as np

        # Decode base64 audio data
        try:
            audio_bytes = base64.b64decode(request.audio_data)
            audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
            # Convert to float32 and normalize
            audio_data = audio_array.astype(np.float32) / 32768.0
        except Exception as e:
            raise HTTPException(
                status_code=422, detail=f"Invalid audio data: {str(e)}"
            ) from e

        # Analyze pronunciation
        analysis = await asr_processor.analyze_pronunciation(
            audio_data, request.reference_text, request.sample_rate
        )

        if analysis is None:
            raise HTTPException(
                status_code=503,
                detail="Pronunciation analysis failed. Please try again.",
            )

        # Convert to Pydantic models for response validation
        word_scores = [
            WordScore(
                word=word.get("word", ""),
                score=word.get("score", 0.0),
                start_time=word.get("start_time", 0.0),
                end_time=word.get("end_time", 0.0),
                phonemes=[
                    PhonemeScore(
                        phoneme=p.get("phoneme", ""),
                        score=p.get("score", 0.0),
                        difficulty=p.get("difficulty", 1),
                        start_time=p.get("start_time", 0.0),
                        end_time=p.get("end_time", 0.0),
                        ipa=p.get("ipa", ""),
                    )
                    for p in word.get("phonemes", [])
                ],
                problem_phonemes=word.get("problem_phonemes", []),
                difficulty=word.get("difficulty", 1),
            )
            for word in analysis.get("word_scores", [])
        ]

        phoneme_scores = [
            PhonemeScore(
                phoneme=p.get("phoneme", ""),
                score=p.get("score", 0.0),
                difficulty=p.get("difficulty", 1),
                start_time=p.get("start_time", 0.0),
                end_time=p.get("end_time", 0.0),
                ipa=p.get("ipa", ""),
            )
            for p in analysis.get("phoneme_scores", [])
        ]

        visual_feedback_data = analysis.get("visual_feedback", {})
        visual_feedback = VisualFeedback(
            timeline=visual_feedback_data.get("timeline", []),
            phoneme_heatmap=visual_feedback_data.get("phoneme_heatmap", {}),
            audio_length=visual_feedback_data.get("audio_length", 0.0),
        )

        return PronunciationAnalysis(
            overall_score=analysis.get("overall_score", 0.0),
            word_scores=word_scores,
            phoneme_scores=phoneme_scores,
            problem_phonemes=analysis.get("problem_phonemes", []),
            transcribed_text=analysis.get("transcribed_text", ""),
            reference_text=analysis.get("reference_text", request.reference_text),
            visual_feedback=visual_feedback,
            suggestions=analysis.get("suggestions", []),
            confidence=analysis.get("confidence", 0.0),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pronunciation analysis error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Internal analysis error: {str(e)}"
        ) from e


@app.get(
    "/pronunciation/practice-words/{phoneme}",
    tags=["pronunciation"],
    response_model=PracticeWordsResponse,
)
async def get_practice_words(phoneme: str, difficulty_level: int = 1):
    """
    Get practice words for a specific Bulgarian phoneme.

    Returns a list of Bulgarian words that contain the target phoneme,
    suitable for pronunciation practice at the specified difficulty level.
    """
    if difficulty_level < 1 or difficulty_level > 4:
        raise HTTPException(
            status_code=422, detail="Difficulty level must be between 1 and 4"
        )

    practice_words = asr_processor.get_pronunciation_practice_words(
        phoneme, difficulty_level
    )

    return PracticeWordsResponse(
        phoneme=phoneme,
        practice_words=practice_words,
        difficulty_level=difficulty_level,
    )


@app.post(
    "/pronunciation/practice-words",
    tags=["pronunciation"],
    response_model=PracticeWordsResponse,
)
async def get_practice_words_post(request: PracticeWordsRequest):
    """
    Get practice words for a specific Bulgarian phoneme (POST version).

    Alternative endpoint that accepts a JSON request body for more complex
    practice word selection logic.
    """
    practice_words = asr_processor.get_pronunciation_practice_words(
        request.phoneme, request.difficulty_level
    )

    return PracticeWordsResponse(
        phoneme=request.phoneme,
        practice_words=practice_words,
        difficulty_level=request.difficulty_level,
    )


@app.get(
    "/pronunciation/status",
    tags=["pronunciation"],
    response_model=dict,
)
async def get_pronunciation_status():
    """
    Get pronunciation scoring system status.

    Returns information about whether pronunciation scoring is enabled
    and what features are available.
    """
    is_enabled = asr_processor.is_pronunciation_scoring_enabled()

    status = {
        "enabled": is_enabled,
        "features": {
            "phoneme_analysis": is_enabled,
            "word_scoring": is_enabled,
            "visual_feedback": is_enabled,
            "practice_words": True,  # Always available
        },
    }

    if is_enabled and asr_processor.pronunciation_scorer:
        # Add more detailed status if scorer is available
        status["scorer_initialized"] = asr_processor.pronunciation_scorer.is_initialized
        status["supported_phonemes"] = list(
            asr_processor.pronunciation_scorer.bulgarian_phonemes.keys()
        )

    return status


# Serve static files in production
if os.path.exists("../client/dist"):
    app.mount("/", StaticFiles(directory="../client/dist", html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
