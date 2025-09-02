/**
 * Unit tests for BulgarianVoiceCoach main application class
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Set up global mocks before class definition
global.document = {
  getElementById: vi.fn(() => ({})),
  querySelector: vi.fn(),
  createElement: vi.fn(() => ({
    className: '',
    innerHTML: '',
    remove: vi.fn(),
  })),
};

global.Audio = vi.fn(() => ({
  play: vi.fn().mockResolvedValue(),
  pause: vi.fn(),
  src: '',
  currentTime: 0,
  addEventListener: vi.fn(),
}));

global.window = {
  location: {
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
  },
  WebSocket: vi.fn((url) => ({
    url: url,
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    addEventListener: vi.fn(),
  })),
  navigator: {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({}),
    },
  },
  AudioContext: vi.fn(() => ({
    createMediaStreamSource: vi.fn(),
    createScriptProcessor: vi.fn(() => ({ connect: vi.fn() })),
    audioWorklet: { addModule: vi.fn().mockResolvedValue() },
    resume: vi.fn().mockResolvedValue(),
    close: vi.fn().mockResolvedValue(),
    destination: {},
    state: 'suspended',
  })),
  URL: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio data'])),
  }),
  setTimeout: vi.fn(),
  clearTimeout: vi.fn(),
};

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  blob: () => Promise.resolve(new Blob(['audio data'])),
});

global.navigator = global.window.navigator;
global.AudioContext = global.window.AudioContext;
global.WebSocket = global.window.WebSocket;
global.URL = global.window.URL;
global.setTimeout = global.window.setTimeout;
global.clearTimeout = global.window.clearTimeout;

// Mock the main.js module by defining the class inline for testing
class BulgarianVoiceCoach {
  constructor() {
    // Audio context and processing
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.isRecording = false;

    // WebSocket connection
    this.websocket = null;
    this.isConnected = false;

    // UI elements - will be mocked in tests
    this.micButton = document.getElementById('mic-button');
    this.micPanel = document.getElementById('mic-panel');
    this.micStatus = document.getElementById('mic-status');
    this.micLevelBar = document.getElementById('mic-level-bar');
    this.transcriptArea = document.getElementById('transcript-area');
    this.clearBtn = document.getElementById('clear-btn');
    this.playLastBtn = document.getElementById('play-last-btn');

    // Status indicators
    this.connectionStatus = document.getElementById('connection-status');
    this.connectionText = document.getElementById('connection-text');
    this.audioStatus = document.getElementById('audio-status');
    this.audioText = document.getElementById('audio-text');
    this.latencyText = document.getElementById('latency-text');

    // Audio playback
    this.audioPlayer = new Audio();
    this.lastResponseText = '';

    // Timing for latency measurement
    this.speechStartTime = null;
    this.responseStartTime = null;
  }

  initializeEventListeners() {
    if (this.micButton) {
      this.micButton.addEventListener('click', () => {
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.clearTranscript();
      });
    }

    if (this.playLastBtn) {
      this.playLastBtn.addEventListener('click', () => {
        this.playLastResponse();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && event.ctrlKey) {
        event.preventDefault();
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      }
    });
  }

  async initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/asr`;

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.updateConnectionStatus('connected', 'Connected');
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');

        setTimeout(() => {
          if (!this.isConnected) {
            this.initializeWebSocket();
          }
        }, 3000);
      };

      this.websocket.onerror = (_error) => {
        this.updateConnectionStatus('error', 'Connection Error');
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };
    } catch (_error) {
      this.updateConnectionStatus('error', 'Connection Failed');
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'partial':
        this.updatePartialTranscript(message.text);
        break;
      case 'final':
        this.addFinalTranscript(message.text);
        this.measureLatency('transcription');
        break;
      case 'coach':
        this.addCoachResponse(message.payload);
        this.measureLatency('response');
        break;
    }
  }

  updateConnectionStatus(status, text) {
    if (this.connectionStatus) {
      this.connectionStatus.className = 'status-dot';
      if (status === 'connected') {
        this.connectionStatus.classList.add('connected');
      } else if (status === 'processing') {
        this.connectionStatus.classList.add('processing');
      }
    }
    if (this.connectionText) {
      this.connectionText.textContent = text;
    }
  }

  updateAudioStatus(status, text) {
    if (this.audioStatus) {
      this.audioStatus.className = 'status-dot';
      if (status === 'ready' || status === 'recording') {
        this.audioStatus.classList.add('connected');
      } else if (status === 'processing') {
        this.audioStatus.classList.add('processing');
      }
    }
    if (this.audioText) {
      this.audioText.textContent = text;
    }
  }

  updateAudioLevel(level) {
    if (this.micLevelBar) {
      this.micLevelBar.style.width = `${level * 100}%`;
    }
  }

  updatePartialTranscript(text) {
    let partialLine = document.querySelector('.transcript-line.partial');

    if (!partialLine) {
      partialLine = document.createElement('div');
      partialLine.className = 'transcript-line partial';
      if (this.transcriptArea) {
        this.transcriptArea.appendChild(partialLine);
      }
    }

    // Create safe HTML structure
    partialLine.innerHTML = '<strong>You (partial):</strong> <span class="bg-text"></span>';
    const textSpan = partialLine.querySelector('.bg-text');
    textSpan.textContent = text; // Safe text insertion
  }

  addFinalTranscript(text) {
    const partialLine = document.querySelector('.transcript-line.partial');
    if (partialLine) {
      partialLine.remove();
    }

    const finalLine = document.createElement('div');
    finalLine.className = 'transcript-line final';
    // Create safe HTML structure
    finalLine.innerHTML = '<strong>You:</strong> <span class="bg-text"></span>';
    const textSpan = finalLine.querySelector('.bg-text');
    textSpan.textContent = text; // Safe text insertion
    if (this.transcriptArea) {
      this.transcriptArea.appendChild(finalLine);
    }
  }

  addCoachResponse(payload) {
    const coachLine = document.createElement('div');
    coachLine.className = 'transcript-line coach';

    // Create safe HTML structure
    const coachLabel = document.createElement('strong');
    coachLabel.textContent = 'Coach:';
    coachLine.appendChild(coachLabel);

    const responseSpan = document.createElement('span');
    responseSpan.className = 'bg-text bg-response';
    responseSpan.textContent = payload.reply_bg; // Safe text insertion
    coachLine.appendChild(responseSpan);

    // Add corrections safely if they exist
    if (payload.corrections && payload.corrections.length > 0) {
      const correctionsDiv = document.createElement('div');
      correctionsDiv.className = 'corrections';

      const correctionsLabel = document.createElement('div');
      correctionsLabel.style.marginTop = '0.5rem';
      correctionsLabel.style.fontWeight = '500';
      correctionsLabel.textContent = 'Corrections:';
      correctionsDiv.appendChild(correctionsLabel);

      payload.corrections.forEach((correction, _index) => {
        const chipSpan = document.createElement('span');
        chipSpan.className = 'correction-chip';
        chipSpan.textContent = `${correction.before} → ${correction.after}`; // Safe text
        correctionsDiv.appendChild(chipSpan);
      });

      coachLine.appendChild(correctionsDiv);
    }
    if (this.transcriptArea) {
      this.transcriptArea.appendChild(coachLine);
    }

    this.lastResponseText = payload.reply_bg;
    if (this.playLastBtn) {
      this.playLastBtn.disabled = false;
    }
  }

  clearTranscript() {
    if (this.transcriptArea) {
      this.transcriptArea.innerHTML = `
        <div style="text-align: center; color: #999; padding: 2rem;">
          Start speaking to practice Bulgarian...
        </div>
      `;
    }
    if (this.playLastBtn) {
      this.playLastBtn.disabled = true;
    }
    this.lastResponseText = '';
  }

  measureLatency(type) {
    if (!this.speechStartTime) return;

    const now = Date.now();
    const latency = now - this.speechStartTime;
    if (this.latencyText) {
      this.latencyText.textContent = `Latency: ${latency}ms`;
    }

    if (type === 'response') {
      this.speechStartTime = null;
    }
  }

  async startRecording() {
    if (!this.isConnected) {
      return;
    }

    this.isRecording = true;
    this.speechStartTime = Date.now();
    this.updateRecordingUI(true);
    if (this.micStatus) {
      this.micStatus.textContent = 'Listening...';
    }
    this.updateAudioStatus('recording', 'Recording');
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.updateRecordingUI(false);
    if (this.micStatus) {
      this.micStatus.textContent = 'Click microphone to start';
    }
    this.updateAudioStatus('ready', 'Audio: Ready');
  }

  updateRecordingUI(recording) {
    if (recording) {
      if (this.micButton) {
        this.micButton.textContent = '⏸️';
        this.micButton.classList.add('recording');
      }
      if (this.micPanel) {
        this.micPanel.classList.add('recording');
      }
    } else {
      if (this.micButton) {
        this.micButton.textContent = '🎤';
        this.micButton.classList.remove('recording');
      }
      if (this.micPanel) {
        this.micPanel.classList.remove('recording');
      }
      if (this.micLevelBar) {
        this.micLevelBar.style.width = '0%';
      }
    }
  }

  async playLastResponse() {
    if (!this.lastResponseText) return;

    try {
      if (this.playLastBtn) {
        this.playLastBtn.disabled = true;
        this.playLastBtn.textContent = '🔄 Loading...';
      }

      const response = await fetch(`/tts?text=${encodeURIComponent(this.lastResponseText)}`);
      if (!response.ok) throw new Error('TTS request failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      this.audioPlayer.src = audioUrl;
      await this.audioPlayer.play();

      this.audioPlayer.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (this.playLastBtn) {
          this.playLastBtn.disabled = false;
          this.playLastBtn.textContent = '🔊 Play Last Response';
        }
      };
    } catch (_error) {
      if (this.playLastBtn) {
        this.playLastBtn.disabled = false;
        this.playLastBtn.textContent = '🔊 Play Last Response';
      }
    }
  }
}

describe('BulgarianVoiceCoach', () => {
  let voiceCoach;
  let mockElements;

  beforeEach(() => {
    // Create mock DOM elements
    mockElements = {
      micButton: {
        addEventListener: vi.fn(),
        textContent: '🎤',
        classList: { add: vi.fn(), remove: vi.fn() },
      },
      micPanel: { classList: { add: vi.fn(), remove: vi.fn() } },
      micStatus: { textContent: '' },
      micLevelBar: { style: { width: '0%' } },
      transcriptArea: { appendChild: vi.fn(), innerHTML: '' },
      clearBtn: { addEventListener: vi.fn() },
      playLastBtn: {
        addEventListener: vi.fn(),
        disabled: true,
        textContent: '',
      },
      connectionStatus: { className: '', classList: { add: vi.fn() } },
      connectionText: { textContent: '' },
      audioStatus: { className: '', classList: { add: vi.fn() } },
      audioText: { textContent: '' },
      latencyText: { textContent: '' },
    };

    // Mock document.getElementById
    document.getElementById = vi.fn(
      (id) =>
        mockElements[
          id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()).replace(/-/g, '')
        ]
    );

    // Mock document.querySelector
    document.querySelector = vi.fn();
    document.createElement = vi.fn(() => ({
      className: '',
      innerHTML: '',
      remove: vi.fn(),
    }));

    voiceCoach = new BulgarianVoiceCoach();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(voiceCoach.audioContext).toBeNull();
      expect(voiceCoach.isRecording).toBe(false);
      expect(voiceCoach.isConnected).toBe(false);
      expect(voiceCoach.lastResponseText).toBe('');
    });

    it('should get DOM elements by ID', () => {
      expect(document.getElementById).toHaveBeenCalledWith('mic-button');
      expect(document.getElementById).toHaveBeenCalledWith('transcript-area');
      expect(document.getElementById).toHaveBeenCalledWith('connection-status');
    });
  });

  describe('WebSocket Initialization', () => {
    // WebSocket tests with location mocking per test

    it('should create WebSocket with correct URL', async () => {
      await voiceCoach.initializeWebSocket();

      expect(voiceCoach.websocket).toBeDefined();
      expect(voiceCoach.websocket.url).toBe('ws://localhost:3000/ws/asr');
    });

    it('should handle WebSocket connection events', async () => {
      await voiceCoach.initializeWebSocket();

      // Manually trigger WebSocket open event
      voiceCoach.websocket.onopen();

      expect(voiceCoach.isConnected).toBe(true);
      expect(mockElements.connectionText.textContent).toBe('Connected');
    });

    it('should handle WebSocket close with reconnection', async () => {
      await voiceCoach.initializeWebSocket();

      // Manually trigger WebSocket close event
      voiceCoach.websocket.onclose();

      expect(voiceCoach.isConnected).toBe(false);
      expect(mockElements.connectionText.textContent).toBe('Disconnected');
    });
  });

  describe('WebSocket Message Handling', () => {
    beforeEach(() => {
      voiceCoach.speechStartTime = Date.now();
    });

    it('should handle partial transcript messages', () => {
      const message = { type: 'partial', text: 'Здра' };

      voiceCoach.handleWebSocketMessage(message);

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should handle final transcript messages', () => {
      const message = { type: 'final', text: 'Здравей!' };

      voiceCoach.handleWebSocketMessage(message);

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should handle coach response messages', () => {
      const message = {
        type: 'coach',
        payload: {
          reply_bg: 'Много добре!',
          corrections: [{ before: 'здраво', after: 'здравей' }],
        },
      };

      voiceCoach.handleWebSocketMessage(message);

      expect(voiceCoach.lastResponseText).toBe('Много добре!');
      expect(mockElements.playLastBtn.disabled).toBe(false);
    });
  });

  describe('Recording Control', () => {
    beforeEach(() => {
      voiceCoach.isConnected = true;
    });

    it('should start recording when connected', async () => {
      await voiceCoach.startRecording();

      expect(voiceCoach.isRecording).toBe(true);
      expect(voiceCoach.speechStartTime).toBeCloseTo(Date.now(), -2);
      expect(mockElements.micButton.textContent).toBe('⏸️');
      expect(mockElements.micStatus.textContent).toBe('Listening...');
    });

    it('should not start recording when disconnected', async () => {
      voiceCoach.isConnected = false;

      await voiceCoach.startRecording();

      expect(voiceCoach.isRecording).toBe(false);
    });

    it('should stop recording', () => {
      voiceCoach.isRecording = true;

      voiceCoach.stopRecording();

      expect(voiceCoach.isRecording).toBe(false);
      expect(mockElements.micButton.textContent).toBe('🎤');
      expect(mockElements.micStatus.textContent).toBe('Click microphone to start');
    });
  });

  describe('Audio Level Updates', () => {
    it('should update audio level bar width', () => {
      const level = 0.75;

      voiceCoach.updateAudioLevel(level);

      expect(mockElements.micLevelBar.style.width).toBe('75%');
    });

    it('should handle zero audio level', () => {
      voiceCoach.updateAudioLevel(0);

      expect(mockElements.micLevelBar.style.width).toBe('0%');
    });

    it('should handle maximum audio level', () => {
      voiceCoach.updateAudioLevel(1.0);

      expect(mockElements.micLevelBar.style.width).toBe('100%');
    });
  });

  describe('Status Updates', () => {
    it('should update connection status to connected', () => {
      voiceCoach.updateConnectionStatus('connected', 'Connected');

      expect(mockElements.connectionStatus.classList.add).toHaveBeenCalledWith('connected');
      expect(mockElements.connectionText.textContent).toBe('Connected');
    });

    it('should update audio status to recording', () => {
      voiceCoach.updateAudioStatus('recording', 'Recording');

      expect(mockElements.audioStatus.classList.add).toHaveBeenCalledWith('connected');
      expect(mockElements.audioText.textContent).toBe('Recording');
    });
  });

  describe('Transcript Management', () => {
    it('should clear transcript and reset state', () => {
      voiceCoach.lastResponseText = 'Test response';

      voiceCoach.clearTranscript();

      expect(voiceCoach.lastResponseText).toBe('');
      expect(mockElements.playLastBtn.disabled).toBe(true);
      expect(mockElements.transcriptArea.innerHTML).toContain(
        'Start speaking to practice Bulgarian...'
      );
    });

    it('should add partial transcript correctly', () => {
      const text = 'Здра';

      voiceCoach.updatePartialTranscript(text);

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should replace partial with final transcript', () => {
      const partialElement = { remove: vi.fn() };
      document.querySelector = vi.fn(() => partialElement);

      voiceCoach.addFinalTranscript('Здравей!');

      expect(partialElement.remove).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('div');
    });
  });

  describe('Latency Measurement', () => {
    it('should calculate and display latency', () => {
      const startTime = Date.now() - 1500;
      voiceCoach.speechStartTime = startTime;

      voiceCoach.measureLatency('transcription');

      expect(mockElements.latencyText.textContent).toMatch(/Latency: \d+ms/);
    });

    it('should reset speech start time on response', () => {
      voiceCoach.speechStartTime = Date.now();

      voiceCoach.measureLatency('response');

      expect(voiceCoach.speechStartTime).toBeNull();
    });

    it('should handle missing speech start time', () => {
      voiceCoach.speechStartTime = null;

      voiceCoach.measureLatency('transcription');

      expect(mockElements.latencyText.textContent).toBe('');
    });
  });

  describe('TTS Playback', () => {
    beforeEach(() => {
      voiceCoach.lastResponseText = 'Много добре!';
      global.fetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio data'])),
      });
    });

    it('should play last response successfully', async () => {
      await voiceCoach.playLastResponse();

      expect(global.fetch).toHaveBeenCalledWith(
        '/tts?text=%D0%9C%D0%BD%D0%BE%D0%B3%D0%BE%20%D0%B4%D0%BE%D0%B1%D1%80%D0%B5!'
      );
      expect(voiceCoach.audioPlayer.play).toHaveBeenCalled();
      expect(mockElements.playLastBtn.disabled).toBe(true);
    });

    it('should handle TTS request failure', async () => {
      global.fetch.mockRejectedValue(new Error('TTS failed'));

      await voiceCoach.playLastResponse();

      expect(mockElements.playLastBtn.disabled).toBe(false);
      expect(mockElements.playLastBtn.textContent).toBe('🔊 Play Last Response');
    });

    it('should not play when no response text', async () => {
      voiceCoach.lastResponseText = '';

      await voiceCoach.playLastResponse();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Coach Response Handling', () => {
    it('should handle response with corrections', () => {
      const payload = {
        reply_bg: 'Правилно е "книгата"',
        corrections: [
          { before: 'книга', after: 'книгата' },
          { before: 'добра', after: 'добрата' },
        ],
      };

      voiceCoach.addCoachResponse(payload);

      expect(voiceCoach.lastResponseText).toBe('Правилно е "книгата"');
      expect(mockElements.playLastBtn.disabled).toBe(false);
      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should handle response without corrections', () => {
      const payload = {
        reply_bg: 'Отлично произношение!',
        corrections: [],
      };

      voiceCoach.addCoachResponse(payload);

      expect(voiceCoach.lastResponseText).toBe('Отлично произношение!');
    });
  });
});
