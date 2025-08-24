import os

import uvicorn
from asr import ASRProcessor
from bg_rules import detect_grammar_errors
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from llm import DummyProvider
from pydantic import BaseModel
from tts import TTSProcessor

from content import get_grammar_item, get_next_lesson, load_grammar_pack, load_scenarios

app = FastAPI(title="Bulgarian Voice Coach", version="0.1.0")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
GRAMMAR_INDEX: dict = {}
SCENARIOS: dict = {}
asr_processor: ASRProcessor | None = None
tts_processor: TTSProcessor | None = None
chat_provider: DummyProvider | None = None


class CoachResponse(BaseModel):
    reply_bg: str
    corrections: list[dict]
    contrastive_note: str | None
    drills: list[dict] = []


@app.on_event("startup")
async def startup_event():
    """Initialize processors and load content on startup"""
    global asr_processor, tts_processor, chat_provider, GRAMMAR_INDEX, SCENARIOS

    # Initialize processors
    asr_processor = ASRProcessor()
    tts_processor = TTSProcessor()

    # Initialize chat provider (dummy for now)
    chat_provider = DummyProvider()

    # Load content
    try:
        GRAMMAR_INDEX = load_grammar_pack()
        SCENARIOS = load_scenarios()
        print(
            f"Loaded {len(GRAMMAR_INDEX)} grammar items and {len(SCENARIOS)} scenarios"
        )
    except Exception as e:
        print(f"Warning: Could not load content: {e}")
        GRAMMAR_INDEX = {}
        SCENARIOS = {}


@app.websocket("/ws/asr")
async def websocket_asr_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time ASR"""
    await websocket.accept()

    if not asr_processor:
        await websocket.close(code=1000, reason="ASR not initialized")
        return

    try:
        while True:
            # Receive binary audio data
            data = await websocket.receive_bytes()

            # Process audio through ASR
            result = asr_processor.process_audio_chunk(data)

            if result:
                if result["type"] == "partial":
                    await websocket.send_json(
                        {"type": "partial", "text": result["text"]}
                    )
                elif result["type"] == "final":
                    await websocket.send_json({"type": "final", "text": result["text"]})

                    # Process through chat provider
                    coach_response = await process_user_input(result["text"])
                    await websocket.send_json(
                        {"type": "coach", "payload": coach_response.dict()}
                    )

    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close(code=1000, reason=str(e))


async def process_user_input(text: str) -> CoachResponse:
    """Process user input through the coaching pipeline"""

    # Detect grammar errors
    corrections = detect_grammar_errors(text)

    # Get response from chat provider
    system_prompt = """You are a Bulgarian coach for Slavic speakers. Reply ONLY in Bulgarian.
    Provide corrections and a short contrastive note for the user's L1 if provided."""

    reply_bg = await chat_provider.get_response(text, system_prompt)

    # Add drills based on corrections
    drills = []
    for correction in corrections:
        if correction.get("error_tag") in GRAMMAR_INDEX:
            grammar_item = GRAMMAR_INDEX[correction["error_tag"]]
            if "drills" in grammar_item:
                drills.extend(grammar_item["drills"][:1])  # Add one drill per error

    return CoachResponse(
        reply_bg=reply_bg,
        corrections=corrections,
        contrastive_note=None,  # TODO: implement based on user's L1
        drills=drills,
    )


@app.get("/tts")
async def text_to_speech(text: str):
    """Convert text to speech and stream audio"""
    if not tts_processor:
        raise HTTPException(status_code=500, detail="TTS not initialized")

    def generate_audio():
        assert tts_processor is not None
        yield from tts_processor.synthesize_streaming(text)

    return StreamingResponse(
        generate_audio(), media_type="audio/wav", headers={"Cache-Control": "no-cache"}
    )


@app.get("/content/scenarios")
async def get_scenarios():
    """Get list of available scenarios"""
    return list(SCENARIOS.values())


@app.get("/content/grammar/{grammar_id}")
async def get_grammar(grammar_id: str):
    """Get specific grammar item by ID"""
    item = get_grammar_item(grammar_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grammar item not found")
    return item


@app.get("/content/lesson/next")
async def get_next_lesson_endpoint(user_id: str = "default"):
    """Get next lesson based on SRS"""
    return get_next_lesson(user_id)


# Serve static files in production
if os.path.exists("../client/dist"):
    app.mount("/", StaticFiles(directory="../client/dist", html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
