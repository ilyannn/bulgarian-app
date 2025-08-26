/**
 * Vitest setup file - configures global mocks and utilities
 */

// Mock WebSocket globally
global.WebSocket = class MockWebSocket {
	constructor(url) {
		this.url = url;
		this.readyState = WebSocket.CONNECTING;
		this.onopen = null;
		this.onclose = null;
		this.onerror = null;
		this.onmessage = null;

		// Simulate connection after next tick
		setTimeout(() => {
			this.readyState = WebSocket.OPEN;
			if (this.onopen) this.onopen(new Event("open"));
		}, 0);
	}

	send(data) {
		// Store sent data for testing
		if (!this._sentMessages) this._sentMessages = [];
		this._sentMessages.push(data);
	}

	close() {
		this.readyState = WebSocket.CLOSED;
		if (this.onclose) this.onclose(new Event("close"));
	}

	// Helper for tests
	simulateMessage(data) {
		if (this.onmessage) {
			this.onmessage(
				new MessageEvent("message", { data: JSON.stringify(data) }),
			);
		}
	}
};

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

// Mock AudioContext and related APIs
global.AudioContext = class MockAudioContext {
	constructor() {
		this.state = "suspended";
		this.sampleRate = 48000;
		this.audioWorklet = {
			addModule: vi.fn().mockResolvedValue(undefined),
		};
	}

	async resume() {
		this.state = "running";
	}

	createMediaStreamSource() {
		return {
			connect: vi.fn(),
		};
	}

	createScriptProcessor(bufferSize, inputs, outputs) {
		return {
			onaudioprocess: null,
			connect: vi.fn(),
			disconnect: vi.fn(),
		};
	}

	get destination() {
		return { connect: vi.fn() };
	}
};

global.webkitAudioContext = global.AudioContext;

// Mock AudioWorkletNode
global.AudioWorkletNode = class MockAudioWorkletNode {
	constructor(context, processorName) {
		this.context = context;
		this.processorName = processorName;
		this.port = {
			postMessage: vi.fn(),
			onmessage: null,
		};
	}
};

// Mock getUserMedia
global.navigator.mediaDevices = {
	getUserMedia: vi.fn().mockResolvedValue({
		getTracks: () => [
			{
				stop: vi.fn(),
			},
		],
	}),
};

// Mock fetch API for TTS requests
global.fetch = vi.fn();

// Mock Audio element
global.Audio = class MockAudio {
	constructor() {
		this.src = "";
		this.onended = null;
		this.play = vi.fn().mockResolvedValue(undefined);
	}
};

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

// Mock window.location for WebSocket URL construction
Object.defineProperty(window, "location", {
	value: {
		protocol: "http:",
		host: "localhost:3000",
	},
	writable: true,
});

// Mock document.hidden for visibility API
Object.defineProperty(document, "hidden", {
	value: false,
	writable: true,
});

// Suppress console.log during tests unless explicitly needed
const originalConsoleLog = console.log;
console.log = vi.fn();

// Helper to restore console.log for specific tests
global.enableConsoleLog = () => {
	console.log = originalConsoleLog;
};

// Helper to get sent WebSocket messages
global.getWebSocketMessages = (ws) => ws._sentMessages || [];

// Helper to create realistic audio data
global.createMockAudioData = (length = 1024) => {
	const data = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		data[i] = Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.1; // 440Hz sine wave
	}
	return data;
};
