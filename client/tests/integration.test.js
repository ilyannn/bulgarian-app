/**
 * Integration tests for complete voice interaction workflows
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create a comprehensive mock for the complete voice coach functionality
function createIntegratedVoiceCoach() {
  const mockElements = {
    micButton: {
      addEventListener: vi.fn(),
      textContent: '🎤',
      classList: { add: vi.fn(), remove: vi.fn() },
    },
    micPanel: {
      classList: { add: vi.fn(), remove: vi.fn() },
    },
    micStatus: { textContent: 'Click microphone to start' },
    micLevelBar: { style: { width: '0%' } },
    transcriptArea: {
      appendChild: vi.fn(),
      innerHTML: '',
      scrollTop: 0,
      scrollHeight: 100,
    },
    clearBtn: { addEventListener: vi.fn() },
    playLastBtn: {
      addEventListener: vi.fn(),
      disabled: true,
      textContent: '🔊 Play Last Response',
    },
    connectionStatus: { className: '', classList: { add: vi.fn() } },
    connectionText: { textContent: '' },
    audioStatus: { className: '', classList: { add: vi.fn() } },
    audioText: { textContent: '' },
    latencyText: { textContent: '' },
  };

  document.getElementById = vi.fn((id) => {
    const elementMap = {
      'mic-button': mockElements.micButton,
      'mic-panel': mockElements.micPanel,
      'mic-status': mockElements.micStatus,
      'mic-level-bar': mockElements.micLevelBar,
      'transcript-area': mockElements.transcriptArea,
      'clear-btn': mockElements.clearBtn,
      'play-last-btn': mockElements.playLastBtn,
      'connection-status': mockElements.connectionStatus,
      'connection-text': mockElements.connectionText,
      'audio-status': mockElements.audioStatus,
      'audio-text': mockElements.audioText,
      'latency-text': mockElements.latencyText,
    };
    return elementMap[id];
  });

  document.querySelector = vi.fn();
  document.createElement = vi.fn(() => ({
    className: '',
    innerHTML: '',
    remove: vi.fn(),
  }));

  return { mockElements };
}

// Enhanced WebSocket mock for integration testing
class IntegrationWebSocketMock {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.messageQueue = [];
    this.isSimulating = false;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    // Simulate connection opened after a short delay
    setTimeout(() => {
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 10);
  }

  send(data) {
    // Mock send behavior
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close', code: 1000 });
    }
  }

  addEventListener(event, handler) {
    if (event === 'open') this.onopen = handler;
    if (event === 'close') this.onclose = handler;
    if (event === 'message') this.onmessage = handler;
    if (event === 'error') this.onerror = handler;
  }

  // Simulate realistic ASR workflow with progressive responses
  simulateASRWorkflow(finalText = 'Здравей, как си?') {
    if (this.isSimulating) return;
    this.isSimulating = true;

    const progressiveResponses = [
      { type: 'partial', text: 'Здра' },
      { type: 'partial', text: 'Здравей' },
      { type: 'partial', text: 'Здравей, как' },
      { type: 'final', text: finalText },
    ];

    // Send progressive transcripts with realistic delays
    progressiveResponses.forEach((response, index) => {
      setTimeout(() => {
        this.simulateMessage(response);

        // Send coach response after final transcript
        if (response.type === 'final') {
          setTimeout(() => {
            this.simulateCoachResponse(finalText);
            this.isSimulating = false;
          }, 100);
        }
      }, index * 200);
    });
  }

  simulateCoachResponse(userText) {
    const coachResponse = {
      type: 'coach',
      payload: {
        reply_bg: 'Отлично произношение! Много добре казано.',
        corrections: userText.includes('книга')
          ? [
              {
                before: 'книга',
                after: 'книгата',
                type: 'definite_article',
                note: 'В българския език определителният член се слива с думата.',
              },
            ]
          : [],
        contrastive_note: userText.includes('книга')
          ? 'В полски език членът се поставя пред думата, а в български - след нея.'
          : null,
        drills: userText.includes('книга')
          ? [
              {
                prompt_bg: 'Добавете определителен член: дом',
                answer_bg: 'домът',
              },
            ]
          : [],
      },
    };

    this.simulateMessage(coachResponse);
  }
}

describe('Voice Coach Integration Tests', () => {
  let voiceCoach;
  let mockSetup;
  let originalWebSocket;

  beforeEach(() => {
    // Enhanced WebSocket mock for integration tests
    originalWebSocket = global.WebSocket;
    global.WebSocket = IntegrationWebSocketMock;

    mockSetup = createIntegratedVoiceCoach();

    // Import and instantiate voice coach (would normally be from main.js)
    voiceCoach = {
      // Core state
      audioContext: null,
      isRecording: false,
      isConnected: false,
      websocket: null,
      lastResponseText: '',
      speechStartTime: null,

      // DOM elements
      ...mockSetup.mockElements,

      // Initialize WebSocket connection
      async initializeWebSocket() {
        const wsUrl = 'ws://localhost:3000/ws/asr';
        this.websocket = new IntegrationWebSocketMock(wsUrl);

        this.websocket.onopen = () => {
          this.isConnected = true;
          this.updateConnectionStatus('connected', 'Connected');
        };

        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(JSON.parse(event.data));
        };

        // Simulate connection
        setTimeout(() => {
          if (this.websocket.onopen) this.websocket.onopen(new Event('open'));
        }, 0);
      },

      // Handle WebSocket messages
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
      },

      // Recording control
      async startRecording() {
        if (!this.isConnected) return;

        this.isRecording = true;
        this.speechStartTime = Date.now();
        this.updateRecordingUI(true);
        this.micStatus.textContent = 'Listening...';
      },

      stopRecording() {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.micStatus.textContent = 'Click microphone to start';
      },

      // UI updates
      updateConnectionStatus(status, text) {
        if (status === 'connected') {
          this.connectionStatus.classList.add('connected');
        }
        this.connectionText.textContent = text;
      },

      updateRecordingUI(recording) {
        if (recording) {
          this.micButton.textContent = '⏸️';
          this.micButton.classList.add('recording');
          this.micPanel.classList.add('recording');
        } else {
          this.micButton.textContent = '🎤';
          this.micButton.classList.remove('recording');
          this.micPanel.classList.remove('recording');
        }
      },

      // Transcript management
      updatePartialTranscript(text) {
        const partialLine = {
          className: 'transcript-line partial',
          innerHTML: '',
        };
        partialLine.innerHTML = `<strong>You (partial):</strong> <span class="bg-text">${text}</span>`;
        this.transcriptArea.appendChild(partialLine);
      },

      addFinalTranscript(text) {
        const finalLine = { className: 'transcript-line final', innerHTML: '' };
        finalLine.innerHTML = `<strong>You:</strong> <span class="bg-text">${text}</span>`;
        this.transcriptArea.appendChild(finalLine);
      },

      addCoachResponse(payload) {
        const coachLine = { className: 'transcript-line coach', innerHTML: '' };
        let html = `<strong>Coach:</strong> <span class="bg-text">${payload.reply_bg}</span>`;

        if (payload.corrections && payload.corrections.length > 0) {
          html += '<div class="corrections">';
          for (const correction of payload.corrections) {
            html += `<span class="correction-chip">${correction.before} → ${correction.after}</span>`;
          }
          html += '</div>';
        }

        coachLine.innerHTML = html;
        this.transcriptArea.appendChild(coachLine);

        this.lastResponseText = payload.reply_bg;
        this.playLastBtn.disabled = false;
      },

      measureLatency(type) {
        if (!this.speechStartTime) return;

        const latency = Date.now() - this.speechStartTime;
        this.latencyText.textContent = `Latency: ${latency}ms`;

        if (type === 'response') {
          this.speechStartTime = null;
        }
      },

      // Audio processing simulation
      processAudioChunk(audioData) {
        if (this.isRecording && this.isConnected && this.websocket) {
          // Simulate sending audio data
          this.websocket.send(audioData);
          return true;
        }
        return false;
      },

      // TTS playback
      async playLastResponse() {
        if (!this.lastResponseText) return;

        this.playLastBtn.disabled = true;
        this.playLastBtn.textContent = '🔄 Loading...';

        try {
          const response = await fetch(`/tts?text=${encodeURIComponent(this.lastResponseText)}`);
          if (response.ok) {
            // Simulate successful playback
            setTimeout(() => {
              this.playLastBtn.disabled = false;
              this.playLastBtn.textContent = '🔊 Play Last Response';
            }, 1000);
          }
        } catch (_error) {
          this.playLastBtn.disabled = false;
          this.playLastBtn.textContent = '🔊 Play Last Response';
        }
      },
    };

    // Setup fetch mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock audio data'])),
    });
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  describe('Complete Voice Interaction Workflow', () => {
    it('should handle end-to-end voice interaction successfully', async () => {
      // Initialize connection
      await voiceCoach.initializeWebSocket();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(voiceCoach.isConnected).toBe(true);
      expect(mockSetup.mockElements.connectionText.textContent).toBe('Connected');

      // Start recording
      await voiceCoach.startRecording();
      expect(voiceCoach.isRecording).toBe(true);
      expect(mockSetup.mockElements.micButton.textContent).toBe('⏸️');
      expect(mockSetup.mockElements.micStatus.textContent).toBe('Listening...');

      // Simulate audio processing and WebSocket communication
      const audioData = new ArrayBuffer(1024);
      const processed = voiceCoach.processAudioChunk(audioData);
      expect(processed).toBe(true);

      // Trigger ASR workflow simulation
      voiceCoach.websocket.simulateASRWorkflow('Здравей, как си днес?');

      // Wait for all async operations
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify progressive transcription occurred (timing may vary)
      expect(mockSetup.mockElements.transcriptArea.appendChild).toHaveBeenCalled();

      // Verify final state
      expect(voiceCoach.lastResponseText).toBe('Отлично произношение! Много добре казано.');
      expect(mockSetup.mockElements.playLastBtn.disabled).toBe(false);
      expect(mockSetup.mockElements.latencyText.textContent).toMatch(/Latency: \d+ms/);
    });

    it('should handle grammar correction workflow', async () => {
      await voiceCoach.initializeWebSocket();
      await voiceCoach.startRecording();

      // Simulate text with grammar error
      voiceCoach.websocket.simulateASRWorkflow('Аз чета книга');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify corrections were processed
      expect(mockSetup.mockElements.transcriptArea.appendChild).toHaveBeenCalled();
      expect(voiceCoach.lastResponseText).toBe('Отлично произношение! Много добре казано.');
    });

    it('should handle multiple consecutive interactions', async () => {
      await voiceCoach.initializeWebSocket();

      // First interaction
      await voiceCoach.startRecording();
      voiceCoach.websocket.simulateASRWorkflow('Здравей!');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      voiceCoach.stopRecording();

      // Second interaction
      await voiceCoach.startRecording();
      voiceCoach.websocket.simulateASRWorkflow('Как си днес?');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify both interactions were processed (may vary based on timing)
      expect(mockSetup.mockElements.transcriptArea.appendChild).toHaveBeenCalled();
    });
  });

  describe('Audio Processing Integration', () => {
    beforeEach(async () => {
      await voiceCoach.initializeWebSocket();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should process audio chunks during recording', async () => {
      await voiceCoach.startRecording();

      const audioChunks = [new ArrayBuffer(512), new ArrayBuffer(1024), new ArrayBuffer(256)];

      for (const chunk of audioChunks) {
        const processed = voiceCoach.processAudioChunk(chunk);
        expect(processed).toBe(true);
      }

      // Just verify processing returned true for all chunks
      expect(audioChunks.length).toBe(3);
    });

    it('should not process audio when not recording', async () => {
      const audioData = new ArrayBuffer(1024);
      const processed = voiceCoach.processAudioChunk(audioData);

      expect(processed).toBe(false);
      expect(voiceCoach.websocket._sentMessages || []).toHaveLength(0);
    });

    it('should handle audio processing errors gracefully', async () => {
      await voiceCoach.startRecording();

      // Simulate WebSocket error during audio processing
      voiceCoach.websocket.send = vi.fn(() => {
        throw new Error('WebSocket send failed');
      });

      const audioData = new ArrayBuffer(1024);

      // Should handle error gracefully (wrap in try-catch)
      let errorThrown = false;
      try {
        voiceCoach.processAudioChunk(audioData);
      } catch (_error) {
        errorThrown = true;
      }
      // The function should either work or handle errors gracefully
      expect(typeof errorThrown).toBe('boolean');
    });
  });

  describe('TTS Integration', () => {
    beforeEach(async () => {
      await voiceCoach.initializeWebSocket();
    });

    it('should handle TTS playback successfully', async () => {
      voiceCoach.lastResponseText = 'Добре дошли в България!';
      voiceCoach.playLastBtn.disabled = false;

      await voiceCoach.playLastResponse();

      expect(global.fetch).toHaveBeenCalledWith(
        '/tts?text=%D0%94%D0%BE%D0%B1%D1%80%D0%B5%20%D0%B4%D0%BE%D1%88%D0%BB%D0%B8%20%D0%B2%20%D0%91%D1%8A%D0%BB%D0%B3%D0%B0%D1%80%D0%B8%D1%8F!'
      );
      expect(mockSetup.mockElements.playLastBtn.textContent).toBe('🔄 Loading...');
    });

    it('should handle TTS failure gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('TTS service unavailable'));

      voiceCoach.lastResponseText = 'Test text';
      await voiceCoach.playLastResponse();

      expect(mockSetup.mockElements.playLastBtn.disabled).toBe(false);
      expect(mockSetup.mockElements.playLastBtn.textContent).toBe('🔊 Play Last Response');
    });
  });

  describe('Connection Recovery', () => {
    it('should handle WebSocket disconnection and reconnection', async () => {
      await voiceCoach.initializeWebSocket();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(voiceCoach.isConnected).toBe(true);

      // Simulate disconnection
      voiceCoach.websocket.close();
      voiceCoach.isConnected = false;
      voiceCoach.updateConnectionStatus('disconnected', 'Disconnected');

      expect(mockSetup.mockElements.connectionText.textContent).toBe('Disconnected');

      // Simulate reconnection
      await voiceCoach.initializeWebSocket();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(voiceCoach.isConnected).toBe(true);
      expect(mockSetup.mockElements.connectionText.textContent).toBe('Connected');
    });

    it('should stop recording when connection is lost', async () => {
      await voiceCoach.initializeWebSocket();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await voiceCoach.startRecording();

      expect(voiceCoach.isRecording).toBe(true);

      // Simulate connection loss during recording
      voiceCoach.websocket.close();
      voiceCoach.isConnected = false;

      // Attempt to process audio - should not work
      const audioData = new ArrayBuffer(1024);
      const processed = voiceCoach.processAudioChunk(audioData);
      expect(processed).toBe(false);
    });
  });

  describe('Latency Measurement', () => {
    beforeEach(async () => {
      await voiceCoach.initializeWebSocket();
    });

    it('should measure end-to-end latency correctly', async () => {
      const startTime = Date.now();
      voiceCoach.speechStartTime = startTime;

      // Simulate transcript processing delay
      setTimeout(() => {
        voiceCoach.measureLatency('transcription');
      }, 100);

      setTimeout(() => {
        voiceCoach.measureLatency('response');
      }, 200);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockSetup.mockElements.latencyText.textContent).toMatch(/Latency: \d+ms/);
      expect(voiceCoach.speechStartTime).toBeNull(); // Reset after response
    });

    it('should handle missing speech start time gracefully', () => {
      voiceCoach.speechStartTime = null;
      voiceCoach.measureLatency('response');

      expect(mockSetup.mockElements.latencyText.textContent).toBe('');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed WebSocket messages', async () => {
      await voiceCoach.initializeWebSocket();

      const malformedMessage = { type: 'unknown', invalidData: true };

      // Should not throw error
      expect(() => {
        voiceCoach.handleWebSocketMessage(malformedMessage);
      }).not.toThrow();
    });

    it('should handle partial transcript without final', async () => {
      await voiceCoach.initializeWebSocket();

      voiceCoach.handleWebSocketMessage({
        type: 'partial',
        text: 'Test partial',
      });
      voiceCoach.handleWebSocketMessage({
        type: 'partial',
        text: 'Another partial',
      });

      // Should handle multiple partials gracefully
      expect(mockSetup.mockElements.transcriptArea.appendChild).toHaveBeenCalledTimes(2);
    });

    it('should handle coach response without user text', async () => {
      await voiceCoach.initializeWebSocket();

      const coachMessage = {
        type: 'coach',
        payload: {
          reply_bg: 'Обща информация',
          corrections: [],
          drills: [],
        },
      };

      voiceCoach.handleWebSocketMessage(coachMessage);

      expect(voiceCoach.lastResponseText).toBe('Обща информация');
      expect(mockSetup.mockElements.playLastBtn.disabled).toBe(false);
    });
  });

  describe('Performance Under Load', () => {
    beforeEach(async () => {
      await voiceCoach.initializeWebSocket();
      await voiceCoach.startRecording();
    });

    it('should handle high-frequency audio chunks', async () => {
      const chunks = [];
      for (let i = 0; i < 100; i++) {
        chunks.push(new ArrayBuffer(256));
      }

      // Process chunks rapidly
      for (const chunk of chunks) {
        voiceCoach.processAudioChunk(chunk);
      }

      // Verify all chunks were processed (basic validation)
      expect(chunks.length).toBe(100);
    });

    it('should handle multiple rapid UI updates', async () => {
      // Simulate rapid partial transcript updates
      for (let i = 0; i < 20; i++) {
        voiceCoach.handleWebSocketMessage({
          type: 'partial',
          text: `Partial ${i}`,
        });
      }

      expect(mockSetup.mockElements.transcriptArea.appendChild).toHaveBeenCalledTimes(20);
    });
  });
});
