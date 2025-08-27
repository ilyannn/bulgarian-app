/**
 * @fileoverview Tests for enhanced audio playback controls
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Audio Playback Controls', () => {
  let voiceCoach;
  let mockElements;

  beforeEach(async () => {
    // Mock DOM elements for audio controls
    mockElements = {
      playPauseBtn: {
        disabled: false,
        textContent: '▶️ Play Response',
        addEventListener: vi.fn(),
      },
      replayBtn: {
        disabled: false,
        textContent: '🔄 Replay',
        addEventListener: vi.fn(),
      },
      stopBtn: {
        disabled: false,
        textContent: '⏹️ Stop',
        addEventListener: vi.fn(),
      },
      micButton: { addEventListener: vi.fn() },
      clearBtn: { addEventListener: vi.fn() },
      transcriptArea: { innerHTML: '', appendChild: vi.fn(), querySelector: vi.fn() },
      connectionStatus: {},
      audioStatus: {},
      latencyText: {},
      micStatus: {},
      micLevelBar: { style: { width: '0%' } },
      micPanel: { classList: { add: vi.fn(), remove: vi.fn() } },
      connectionText: {},
      audioText: {},
    };

    // Mock getElementById to return our mock elements
    global.document = {
      getElementById: vi.fn(
        (id) => mockElements[id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())]
      ),
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
      createElement: vi.fn(() => ({
        className: '',
        innerHTML: '',
        appendChild: vi.fn(),
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
        style: {},
      })),
      head: { appendChild: vi.fn() },
    };

    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({}),
      },
    };

    global.window = {
      AudioContext: vi.fn(() => ({
        createMediaStreamSource: vi.fn(),
        createScriptProcessor: vi.fn(() => ({ connect: vi.fn() })),
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(),
        },
        resume: vi.fn().mockResolvedValue(),
        close: vi.fn().mockResolvedValue(),
        destination: {},
        state: 'suspended',
      })),
      AudioWorkletNode: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        port: {
          postMessage: vi.fn(),
          onmessage: null,
        },
      })),
      WebSocket: vi.fn(() => ({
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1,
      })),
      URL: {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      },
      fetch: vi.fn(),
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
    };

    global.Audio = vi.fn(() => ({
      play: vi.fn().mockResolvedValue(),
      pause: vi.fn(),
      src: '',
      currentTime: 0,
      addEventListener: vi.fn(),
    }));

    // Import and create voiceCoach instance after mocking
    const mainModule = await import('../main.js');
    // Handle different export patterns
    const BulgarianVoiceCoach = mainModule.default || mainModule.BulgarianVoiceCoach || mainModule;
    voiceCoach = new (
      typeof BulgarianVoiceCoach === 'function'
        ? BulgarianVoiceCoach
        : BulgarianVoiceCoach.BulgarianVoiceCoach
    )();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Audio Control Initialization', () => {
    it('should initialize audio controls with proper disabled state', () => {
      expect(voiceCoach.playPauseBtn).toBeDefined();
      expect(voiceCoach.replayBtn).toBeDefined();
      expect(voiceCoach.stopBtn).toBeDefined();
      expect(voiceCoach.isPlaying).toBe(false);
      expect(voiceCoach.isPaused).toBe(false);
    });

    it('should set up event listeners for audio controls', () => {
      expect(mockElements.playPauseBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.replayBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElements.stopBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });
  });

  describe('Enable/Disable Audio Controls', () => {
    it('should enable audio controls when response is available', () => {
      voiceCoach.lastResponseText = 'Test response';
      voiceCoach.enableAudioControls(true);

      expect(voiceCoach.playPauseBtn.disabled).toBe(false);
      expect(voiceCoach.replayBtn.disabled).toBe(false);
      expect(voiceCoach.stopBtn.disabled).toBe(false);
    });

    it('should disable audio controls when no response available', () => {
      voiceCoach.enableAudioControls(false);

      expect(voiceCoach.playPauseBtn.disabled).toBe(true);
      expect(voiceCoach.replayBtn.disabled).toBe(true);
      expect(voiceCoach.stopBtn.disabled).toBe(true);
      expect(voiceCoach.playPauseBtn.textContent).toBe('▶️ Play Response');
    });
  });

  describe('Audio Loading', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio-data'], { type: 'audio/wav' })),
      });
    });

    it('should load audio successfully', async () => {
      voiceCoach.lastResponseText = 'Test Bulgarian text';

      const result = await voiceCoach.loadAudio();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/tts?text=Test%20Bulgarian%20text');
      expect(voiceCoach.currentAudioUrl).toBe('blob:mock-url');
    });

    it('should handle audio loading errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      voiceCoach.lastResponseText = 'Test text';
      voiceCoach.showError = vi.fn();

      const result = await voiceCoach.loadAudio();

      expect(result).toBe(false);
      expect(voiceCoach.showError).toHaveBeenCalledWith('Could not load audio: TTS request failed');
    });
  });

  describe('Play/Pause Functionality', () => {
    beforeEach(() => {
      voiceCoach.lastResponseText = 'Test response';
      voiceCoach.loadAudio = vi.fn().mockResolvedValue(true);
      voiceCoach.audioPlayer = {
        play: vi.fn().mockResolvedValue(),
        pause: vi.fn(),
        src: '',
        currentTime: 0,
      };
    });

    it('should toggle from stopped to playing', async () => {
      voiceCoach.isPlaying = false;
      voiceCoach.isPaused = false;

      await voiceCoach.togglePlayPause();

      expect(voiceCoach.loadAudio).toHaveBeenCalled();
      expect(voiceCoach.audioPlayer.play).toHaveBeenCalled();
    });

    it('should toggle from playing to paused', async () => {
      voiceCoach.isPlaying = true;
      voiceCoach.isPaused = false;
      voiceCoach.currentAudioUrl = 'blob:test-url';
      voiceCoach.audioPlayer.src = 'blob:test-url';

      await voiceCoach.togglePlayPause();

      expect(voiceCoach.audioPlayer.pause).toHaveBeenCalled();
    });

    it('should handle playback errors gracefully', async () => {
      voiceCoach.loadAudio = vi.fn().mockResolvedValue(true);
      voiceCoach.audioPlayer.play = vi.fn().mockRejectedValue(new Error('Playback failed'));
      voiceCoach.showError = vi.fn();

      await voiceCoach.togglePlayPause();

      expect(voiceCoach.showError).toHaveBeenCalledWith('Playback failed: Playback failed');
    });
  });

  describe('Replay Functionality', () => {
    beforeEach(() => {
      voiceCoach.lastResponseText = 'Test response';
      voiceCoach.loadAudio = vi.fn().mockResolvedValue(true);
      voiceCoach.audioPlayer = {
        play: vi.fn().mockResolvedValue(),
        currentTime: 0,
      };
    });

    it('should replay audio from beginning', async () => {
      voiceCoach.currentAudioUrl = 'blob:test-url';

      await voiceCoach.replayAudio();

      expect(voiceCoach.audioPlayer.currentTime).toBe(0);
      expect(voiceCoach.audioPlayer.play).toHaveBeenCalled();
    });

    it('should load audio if not already loaded before replaying', async () => {
      voiceCoach.currentAudioUrl = null;

      await voiceCoach.replayAudio();

      expect(voiceCoach.loadAudio).toHaveBeenCalled();
      expect(voiceCoach.audioPlayer.play).toHaveBeenCalled();
    });
  });

  describe('Stop Functionality', () => {
    beforeEach(() => {
      voiceCoach.audioPlayer = {
        src: 'blob:test-url',
        pause: vi.fn(),
        currentTime: 0,
      };
    });

    it('should stop audio playback', () => {
      voiceCoach.isPlaying = true;
      voiceCoach.isPaused = true;

      voiceCoach.stopAudio();

      expect(voiceCoach.audioPlayer.pause).toHaveBeenCalled();
      expect(voiceCoach.audioPlayer.currentTime).toBe(0);
      expect(voiceCoach.isPlaying).toBe(false);
      expect(voiceCoach.isPaused).toBe(false);
      expect(voiceCoach.playPauseBtn.textContent).toBe('▶️ Play Response');
    });
  });

  describe('Audio Event Handlers', () => {
    it('should handle audio playing event', () => {
      voiceCoach.onAudioPlaying();

      expect(voiceCoach.isPlaying).toBe(true);
      expect(voiceCoach.isPaused).toBe(false);
      expect(voiceCoach.playPauseBtn.textContent).toBe('⏸️ Pause');
    });

    it('should handle audio paused event', () => {
      voiceCoach.onAudioPaused();

      expect(voiceCoach.isPaused).toBe(true);
      expect(voiceCoach.playPauseBtn.textContent).toBe('▶️ Resume');
    });

    it('should handle audio ended event', () => {
      voiceCoach.currentAudioUrl = 'blob:test-url';
      voiceCoach.onAudioEnded();

      expect(voiceCoach.isPlaying).toBe(false);
      expect(voiceCoach.isPaused).toBe(false);
      expect(voiceCoach.playPauseBtn.textContent).toBe('▶️ Play Response');
      expect(global.window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
      expect(voiceCoach.currentAudioUrl).toBe(null);
    });

    it('should handle audio error event', () => {
      voiceCoach.showError = vi.fn();

      voiceCoach.onAudioError(new Error('Audio error'));

      expect(voiceCoach.showError).toHaveBeenCalledWith('Audio playback error occurred');
      expect(voiceCoach.isPlaying).toBe(false);
      expect(voiceCoach.isPaused).toBe(false);
      expect(voiceCoach.playPauseBtn.textContent).toBe('▶️ Play Response');
    });
  });
});
