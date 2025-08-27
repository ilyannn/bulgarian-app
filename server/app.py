import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from asr import ASRProcessor
from bg_rules import detect_grammar_errors
from config import ConfigError, get_config
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from llm import DummyProvider
from pydantic import BaseModel
from telemetry import get_telemetry, init_telemetry
from tts import TTSProcessor

from content import (
    get_grammar_item,
    load_grammar_pack,
    load_scenarios,
)

logger = logging.getLogger(__name__)

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

        # Initialize processors
        logger.info("Initializing ASR processor...")
        asr_processor = ASRProcessor()

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


app = FastAPI(title="Bulgarian Voice Coach", version="0.1.0", lifespan=lifespan)

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
                        {"type": "partial", "text": result["text"]}
                    )
                elif result["type"] == "final":
                    await websocket.send_json({"type": "final", "text": result["text"]})

                    # Process through chat provider with telemetry
                    if telemetry_context:
                        with telemetry_context.trace_operation(
                            "coaching_pipeline", input_text=result["text"][:100]
                        ):
                            coach_response = await process_user_input(result["text"])
                    else:
                        coach_response = await process_user_input(result["text"])

                    await websocket.send_json(
                        {"type": "coach", "payload": coach_response.model_dump()}
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


@app.get("/tts")
async def text_to_speech(text: str):
    """Convert text to speech and stream audio"""
    telemetry_context = get_telemetry()

    if not tts_processor:
        raise HTTPException(status_code=500, detail="TTS not initialized")

    if telemetry_context:
        telemetry_context.count_request("GET", "/tts", 200)

    def generate_audio():
        assert tts_processor is not None
        if telemetry_context:
            with telemetry_context.trace_operation(
                "tts_synthesis", text_length=len(text)
            ):
                import time

                start_time = time.time()
                yield from tts_processor.synthesize_streaming(text)
                duration = time.time() - start_time
                telemetry_context.record_audio_processing(duration, "tts_synthesis")
        else:
            yield from tts_processor.synthesize_streaming(text)

    return StreamingResponse(
        generate_audio(), media_type="audio/wav", headers={"Cache-Control": "no-cache"}
    )


@app.get("/content/scenarios")
async def get_scenarios():
    """Get list of available scenarios"""
    return list(scenarios.values())


@app.get("/content/grammar/{grammar_id}")
async def get_grammar(grammar_id: str):
    """Get specific grammar item by ID"""
    item = get_grammar_item(grammar_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grammar item not found")
    return item


@app.get("/content/drills/{grammar_id}")
async def get_drills_for_grammar(grammar_id: str):
    """Get drills for a specific grammar item"""
    item = get_grammar_item(grammar_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grammar item not found")

    return {
        "grammar_id": grammar_id,
        "drills": item.get("drills", []),
        "examples": item.get("examples", []),
        "explanation": item.get("micro_explanation_bg", ""),
    }


@app.post("/content/analyze")
async def analyze_text(request: dict):
    """Analyze Bulgarian text for grammar errors and generate drills"""
    text = request.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    # Detect grammar errors
    corrections = detect_grammar_errors(text)

    # Generate drill suggestions
    drill_suggestions = []
    for correction in corrections:
        error_tag = correction.get("error_tag")
        if error_tag and error_tag in grammar_index:
            grammar_item = grammar_index[error_tag]
            drill_suggestions.append(
                {
                    "grammar_id": error_tag,
                    "explanation": grammar_item.get("micro_explanation_bg", ""),
                    "drills": grammar_item.get("drills", [])[:2],  # Limit to 2 drills
                }
            )

    return {
        "text": text,
        "corrections": corrections,
        "drill_suggestions": drill_suggestions,
    }


# Serve static files in production
if os.path.exists("../client/dist"):
    app.mount("/", StaticFiles(directory="../client/dist", html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
