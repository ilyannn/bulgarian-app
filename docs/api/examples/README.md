# API Integration Examples

This directory contains practical examples for integrating with the Bulgarian Voice Coach API.

## Examples

### Basic Usage

- [`basic-fetch.js`](./basic-fetch.js) - Using standard fetch() API
- [`typescript-sdk.ts`](./typescript-sdk.ts) - Using the generated TypeScript SDK

### Advanced Integration

- [`websocket-asr.js`](./websocket-asr.js) - Real-time speech recognition
- [`voice-profile-selection.ts`](./voice-profile-selection.ts) - TTS voice profiles
- [`grammar-analysis.ts`](./grammar-analysis.ts) - Text analysis with drills

### Progressive Web App

- [`pwa-integration.ts`](./pwa-integration.ts) - Offline-ready integration
- [`service-worker.js`](./service-worker.js) - Background audio processing

## Running Examples

Each example is standalone and can be run directly:

```bash
# For Node.js examples
node docs/api/examples/basic-fetch.js

# For TypeScript examples
bunx tsx docs/api/examples/typescript-sdk.ts

# For browser examples
# Open in browser with development server running
```

## Prerequisites

- Development server running (`just dev`)
- For TypeScript examples: `bun install` in project root
- For WebSocket examples: Microphone permissions in browser
