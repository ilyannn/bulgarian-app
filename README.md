# Bulgarian Voice Coach

A voice-enabled web application for teaching Bulgarian to Slavic speakers, featuring real-time speech recognition, grammar correction, and text-to-speech feedback.

## Features

- 🎤 **Real-time Speech Recognition** - Uses faster-whisper with VAD for accurate Bulgarian transcription
- 🗣️ **Text-to-Speech** - eSpeak-NG for Bulgarian pronunciation (upgradeable to Piper)
- 📝 **Grammar Correction** - Detects common mistakes made by Slavic speakers
- 🎯 **Spaced Repetition** - SRS system for grammar drills and exercises
- 🔤 **Bulgarian Typography** - Proper Cyrillic rendering with Ysabeau font
- 💬 **AI Coaching** - Conversational practice with Claude/OpenAI integration

## Tech Stack

**Backend:**
- Python 3.11 with FastAPI
- faster-whisper (CTranslate2) for ASR
- eSpeak-NG for TTS
- WebSocket for real-time communication

**Frontend:**
- Vanilla JavaScript with Vite
- AudioWorklet for low-latency audio processing
- Modern CSS with Bulgarian typography support

**Grammar Engine:**
- Lightweight rule-based Bulgarian grammar detection
- Focus on definite articles, infinitive constructions, future tense, clitics

## Prerequisites

1. **Python 3.11** or later
2. **Node.js 18** or later
3. **eSpeak-NG** - Install via package manager:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install espeak-ng

   # macOS
   brew install espeak-ng

   # Windows (via Chocolatey)
   choco install espeak-ng
   ```
4. **just** command runner

## Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd bulgarian-app
   just install
   ```

2. **Configure environment** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and model paths
   ```

3. **Run development servers:**
   ```bash
   just dev
   ```

4. **Open browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## Configuration

Create a `.env` file in the project root:

```bash
# Whisper model path (or leave blank for auto-download)
WHISPER_MODEL_PATH=medium

# Chat provider (auto, openai, claude, dummy)
CHAT_PROVIDER=auto

# API keys (only if using hosted LLMs)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_claude_key_here
```

## Content Files

The app expects these content files in `server/content/`:

- `bg_grammar_pack.json` - Grammar rules and exercises
- `bg_scenarios_with_grammar.json` - Practice scenarios

Sample files are auto-generated if missing. For production, provide your own content files.

## Development Commands

```bash
# Install dependencies
just install

# Run development servers (FastAPI + Vite)
just dev

# Run linting
just lint

# Format code
just format

# Run tests
just test

# Production-like serve
just serve
```

## Grammar Detection

The app detects common Bulgarian grammar errors made by Slavic speakers:

### Definite Articles
- **Issue:** Missing or incorrect postposed articles (-ът, -та, -то, -те)
- **Example:** "стол" → "столът" (when referring to a specific chair)

### No Infinitive Construction
- **Issue:** Using infinitive-like forms instead of "да" + present
- **Example:** "Искам поръчвам" → "Искам да поръчам"

### Future Tense
- **Issue:** Missing "ще" for future actions
- **Example:** "Утре ходя" → "Утре ще ходя"

### Clitic Positioning
- **Issue:** Incorrect placement of clitic pronouns
- **Example:** Proper positioning after "не" and certain particles

## Audio Configuration

### Sample Rates
- **Input:** 48kHz (browser default) → resampled to 16kHz
- **Processing:** 16kHz mono PCM Int16 frames
- **Output:** 22kHz (eSpeak default)

### Latency Budget
- 20-40ms frames → 200-400ms VAD → 0.5-1.0s ASR → ~0.2s TTS
- **Target:** 1.2-2.0s total latency

### Browser Support
- **Primary:** AudioWorklet (Chrome 64+, Firefox 76+, Safari 14.1+)
- **Fallback:** ScriptProcessor for older browsers

## Typography

Bulgarian text uses the **Ysabeau** font family optimized for Cyrillic:

1. Download Ysabeau font files from [Google Fonts](https://fonts.google.com/specimen/Ysabeau)
2. Place in `client/assets/fonts/`
3. Bulgarian text automatically uses proper typography with `:lang(bg)` and `.bg-text`

## Deployment

### Production Build
```bash
# Build frontend
cd client && npm run build

# Serve with production settings
just serve
```

### Docker (Optional)
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y espeak-ng
COPY . /app
WORKDIR /app
RUN pip install -r server/requirements.txt
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0"]
```

### Environment Variables
- `WHISPER_MODEL_PATH` - Path to Whisper model or model name
- `CHAT_PROVIDER` - LLM provider (auto/openai/claude/dummy)
- `OPENAI_API_KEY` - OpenAI API key (if using)
- `ANTHROPIC_API_KEY` - Claude API key (if using)

## Contributing

1. Follow the existing code style (Black, isort, Ruff for Python; Prettier for JS)
2. Run `just lint` before committing
3. Add tests for new features
4. Update documentation as needed

### Code Style
- **Python:** Black formatting, isort imports, Ruff linting
- **JavaScript:** Prettier formatting
- **Commits:** Conventional commits preferred

## Troubleshooting

### Common Issues

**eSpeak-NG not found:**
```bash
# Install eSpeak-NG for your system
sudo apt-get install espeak-ng  # Ubuntu/Debian
brew install espeak-ng          # macOS
```

**Microphone not working:**
- Ensure HTTPS in production (required for getUserMedia)
- Check browser permissions
- Test with different browsers

**WebSocket connection fails:**
- Check if backend is running on port 8000
- Verify firewall settings
- Check proxy configuration in `vite.config.js`

**Audio quality issues:**
- Verify 16kHz processing chain
- Check VAD sensitivity settings
- Test with different microphones

### Performance Tuning

**ASR Latency:**
- Use smaller Whisper model (tiny/base vs medium/large)
- Adjust VAD parameters
- Reduce beam size and temperature

**Memory Usage:**
- Monitor Whisper model size
- Adjust audio buffer sizes
- Use model quantization (int8/int16)

## License

[Add your license here]

## Acknowledgments

- **faster-whisper** - Fast Whisper implementation
- **eSpeak-NG** - Open source speech synthesis
- **Ysabeau** - Cyrillic typography by Catharsis Fonts
- **FastAPI** - Modern Python web framework
- **Vite** - Fast frontend build tool
