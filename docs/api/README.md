# Bulgarian Voice Coach API Documentation

## Overview

The Bulgarian Voice Coach API provides endpoints for voice-enabled language learning with real-time speech recognition,
text-to-speech synthesis, and grammar error detection. This API follows REST principles and uses JSON for data exchange.

**Base URL**: `http://localhost:8000` (development), `http://localhost:8001` (production)

## Architecture

### Local-First Design

The API is designed with a **local-first architecture**:

- ✅ **No authentication required** - runs locally on your machine
- ✅ **No user data stored server-side** - all progress stored in browser localStorage
- ✅ **Privacy by default** - user data never leaves your device
- ✅ **Real-time processing** - low-latency ASR and TTS

### Technology Stack

- **Backend**: FastAPI (Python) with WebSocket support
- **ASR**: faster-whisper for Bulgarian speech recognition
- **TTS**: eSpeak NG with multiple voice profiles
- **Content**: JSON-based grammar packs and scenarios

## Getting Started

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/bulgarian-app
cd bulgarian-app

# Install dependencies
just install

# Start development servers
just dev
```

### Using the TypeScript SDK

The API includes a generated TypeScript SDK for type-safe integration:

```typescript
import { ContentService, TtsService, type AnalyzeTextRequest } from "./sdk";

// Configure base URL
import { OpenAPI } from "./sdk/core/OpenAPI";
OpenAPI.BASE = "http://localhost:8000";

// Analyze Bulgarian text
const request: AnalyzeTextRequest = {
  text: "Искам поръчвам кафе",
  l1: "PL",
};

const analysis = await ContentService.analyzeTextContentAnalyzePost(request);
console.log(analysis.corrections); // Grammar corrections
console.log(analysis.drill_suggestions); // Practice drills
```

## API Endpoints

### Health Check

#### GET /health

RFC-compliant health check endpoint.

**Response**: `200 OK` (healthy) or `503 Service Unavailable` (unhealthy)

```json
{
  "status": "pass",
  "version": "0.1.0",
  "serviceId": "bulgarian-voice-coach-api",
  "checks": {
    "asr:availability": {
      "status": "pass",
      "componentType": "service",
      "observedValue": true
    }
  }
}
```

### Text-to-Speech

#### GET /tts

Convert Bulgarian text to speech with voice profiles.

**Parameters**:

- `text` (required): Bulgarian text to synthesize
- `profile` (optional): Voice profile (`natural`, `standard`, `slow`, `expressive`, `clear`)
- `track_timing` (optional): Include performance metrics

**Example**:

```bash
curl "http://localhost:8000/tts?text=Здравей!&profile=natural"
```

**Response**: Audio stream (WAV format)

#### GET /tts/profiles

Get available TTS voice profiles.

**Response**:

```json
{
  "profiles": {
    "current_profile": "natural",
    "available_profiles": {
      "natural": { "speed": 175, "pitch": 50, "volume": 90 },
      "slow": { "speed": 120, "pitch": 50, "volume": 85 },
      "expressive": { "speed": 185, "pitch": 60, "volume": 95 }
    }
  }
}
```

### Content & Grammar

#### GET /content/scenarios

Get available conversation scenarios.

**Response**:

```json
[
  {
    "id": "a2_cafe_ordering",
    "title": "В кафене: поръчка",
    "level": "A2",
    "description": "Practice ordering food and drinks"
  }
]
```

#### GET /content/grammar/{grammar_id}

Get specific grammar rule with L1-specific contrast notes.

**Parameters**:

- `grammar_id` (required): Grammar rule identifier
- `l1` (optional): L1 language code for contrasts

**Example**:

```bash
curl "http://localhost:8000/content/grammar/bg.no_infinitive.da_present?l1=PL"
```

**Response**:

```json
{
  "id": "bg.no_infinitive.da_present",
  "title_bg": "Няма инфинитив: 'да' + сегашно",
  "micro_explanation_bg": "В български няма инфинитив. Използваме 'да' + сегашно.",
  "contrast_notes": {
    "PL": "Polish uses infinitive: chcę zamówić"
  },
  "examples": [
    {
      "wrong": "Искам поръчвам кафе.",
      "right": "Искам да поръчам кафе."
    }
  ]
}
```

#### POST /content/analyze

Analyze Bulgarian text for grammar errors and get drill suggestions.

**Request Body**:

```json
{
  "text": "Искам поръчвам кафе",
  "l1": "PL"
}
```

**Response**:

```json
{
  "text": "Искам поръчвам кафе",
  "corrections": [
    {
      "type": "infinitive_usage",
      "before": "искам поръчвам",
      "after": "искам да поръчам",
      "note": "В български използваме 'да' + сегашно вместо инфинитив",
      "error_tag": "bg.no_infinitive.da_present"
    }
  ],
  "drill_suggestions": [
    {
      "grammar_id": "bg.no_infinitive.da_present",
      "explanation": "В български няма инфинитив...",
      "contrast_note": "Polish uses infinitive: chcę zamówić",
      "drills": [
        {
          "type": "transform",
          "prompt_bg": "Мога ___ (идвам) утре.",
          "answer_bg": "да дойда"
        }
      ]
    }
  ],
  "l1_language": "PL"
}
```

### Configuration

#### GET /api/config

Get current application configuration.

**Response**:

```json
{
  "l1_language": "PL",
  "supported_languages": ["PL", "RU", "UK", "SR"],
  "language_names": {
    "PL": "Polski (Polish)",
    "RU": "Русский (Russian)",
    "UK": "Українська (Ukrainian)",
    "SR": "Српски (Serbian)"
  }
}
```

#### POST /api/config/l1

Update L1 language preference.

**Request Body**:

```json
{
  "l1_language": "RU"
}
```

**Response**:

```json
{
  "l1_language": "RU",
  "status": "updated"
}
```

## WebSocket API

### Real-Time ASR

#### WebSocket /ws/asr

Real-time speech recognition for Bulgarian audio.

**Connection**:

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/asr");

ws.onopen = () => {
  console.log("ASR WebSocket connected");
};

ws.onmessage = event => {
  const result = JSON.parse(event.data);

  if (result.type === "partial") {
    // Partial transcription result
    console.log("Partial:", result.text);
  } else if (result.type === "final") {
    // Final transcription result
    console.log("Final:", result.text, "Confidence:", result.confidence);
  }
};

// Send audio data (16kHz PCM, Float32Array)
const audioData = new Float32Array(1024); // Your audio samples
ws.send(audioData.buffer);
```

**Message Types**:

**Partial Result**:

```json
{
  "type": "partial",
  "text": "Здра",
  "confidence": null
}
```

**Final Result**:

```json
{
  "type": "final",
  "text": "Здравейте!",
  "confidence": 0.95,
  "duration_ms": 1234
}
```

**Error**:

```json
{
  "type": "error",
  "error": "ASR processing failed"
}
```

## Error Handling

All endpoints use consistent error response format:

```json
{
  "error": "validation_error",
  "message": "Invalid L1 language. Use PL, RU, UK, or SR",
  "details": {
    "field": "l1_language",
    "received": "EN"
  }
}
```

**HTTP Status Codes**:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Resource not found
- `422` - Validation Error (Pydantic validation failed)
- `500` - Internal Server Error
- `503` - Service Unavailable (health check failure)

## Performance Guidelines

### Latency Targets

- **End-to-end voice interaction**: 1.2-2.0 seconds
- **TTS generation**: ~200ms for typical sentences
- **ASR processing**: 0.5-1.0 seconds
- **Text analysis**: <100ms

### Rate Limiting

No rate limiting is enforced (local deployment), but consider:

- **TTS requests**: Recommended max 10 requests/second
- **WebSocket connections**: 1 connection per client
- **Analysis requests**: Unlimited for text <1000 characters

### Audio Format Requirements

- **Sample rate**: 16kHz
- **Format**: PCM (Float32Array for WebSocket)
- **Channels**: Mono (1 channel)
- **Chunk size**: 1024 samples recommended

## Migration from Manual Fetch

### Before (Manual fetch)

```javascript
const response = await fetch("/api/config", {
  method: "GET",
  headers: { "Content-Type": "application/json" },
});
const config = await response.json();
```

### After (TypeScript SDK)

```javascript
import { ConfigService } from "./sdk";

// Type-safe, auto-complete, error handling included
const config = await ConfigService.getAppConfigApiConfigGet();
```

### Benefits of SDK Usage

- ✅ **Type safety** - Catch errors at compile time
- ✅ **Auto-completion** - Better developer experience
- ✅ **Generated from spec** - Always up-to-date
- ✅ **Consistent error handling** - Unified error types
- ✅ **Request/response validation** - Runtime type checking

## Development Workflow

### Regenerating SDK

When API changes are made:

```bash
# Regenerate OpenAPI spec and TypeScript SDK
just api-sdk

# Lint the OpenAPI specification
just api-lint

# Run tests to ensure compatibility
just test
```

### Adding New Endpoints

1. **Add endpoint to FastAPI** (`server/app.py`)
2. **Define Pydantic models** for request/response
3. **Add docstrings and examples**
4. **Regenerate SDK**: `just api-sdk`
5. **Update documentation** (`docs/api/README.md`)
6. **Write tests** for the endpoint

### Best Practices

- **Use Pydantic models** for all request/response bodies
- **Include examples** in Field() descriptions
- **Add proper HTTP status codes** in responses
- **Document error scenarios** in docstrings
- **Follow OpenAPI naming conventions** for operation IDs

## Troubleshooting

### Common Issues

**SDK Generation Fails**:

```bash
# Ensure OpenAPI spec is valid
just api-lint

# Check if server is running for live spec
curl http://localhost:8000/openapi.json
```

**WebSocket Connection Issues**:

```javascript
// Check WebSocket URL and protocol
const ws = new WebSocket("ws://localhost:8000/ws/asr"); // Note: ws://, not http://
```

**Audio Processing Errors**:

- Ensure 16kHz sample rate
- Use Float32Array for WebSocket data
- Check microphone permissions in browser

**CORS Issues in Development**:

```javascript
// API allows all origins in development mode
// No additional configuration needed
```

## Support

- **Documentation**: [README.md](../README.md)
- **Architecture**: [DATA_STRUCTURES.md](./DATA_STRUCTURES.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/bulgarian-app/issues)
- **Development**: See [CLAUDE.md](../CLAUDE.md) for contributor guide
