/**
 * @fileoverview Tests for enhanced audio level visualization
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Global mocks needed before main.js import
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

describe('Audio Level Visualization', () => {
  let voiceCoach;
  let mockElements;

  beforeEach(async () => {
    // Mock DOM elements
    mockElements = {
      micLevelBar: {},
      micStatus: { textContent: '' },
      transcriptArea: { innerHTML: '', appendChild: vi.fn(), querySelector: vi.fn() },
      micButton: { addEventListener: vi.fn() },
      clearBtn: { addEventListener: vi.fn() },
      playLastBtn: { addEventListener: vi.fn() },
      playPauseBtn: { addEventListener: vi.fn(), disabled: false },
      replayBtn: { addEventListener: vi.fn(), disabled: false },
      stopBtn: { addEventListener: vi.fn(), disabled: false },
      connectionStatus: {},
      audioStatus: {},
      latencyText: {},
      micPanel: { classList: { add: vi.fn(), remove: vi.fn() } },
      connectionText: {},
      audioText: {},
    };

    // Mock global objects
    global.document = {
      getElementById: vi.fn(
        (id) => mockElements[id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())]
      ),
      addEventListener: vi.fn(),
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => {
        const element = {
          className: '',
          innerHTML: '',
          appendChild: vi.fn(),
          setAttribute: vi.fn(),
          addEventListener: vi.fn(),
          textContent: '',
          id: '',
          parentNode: {
            removeChild: vi.fn(),
          },
        };
        // Create a proper style object that won't cause recursion
        Object.defineProperty(element, 'style', {
          value: {
            width: '',
            background: '',
            cssText: '',
            setProperty: vi.fn(),
            getPropertyValue: vi.fn(),
          },
          writable: true,
          configurable: true,
        });
        return element;
      }),
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
        audioWorklet: { addModule: vi.fn().mockResolvedValue() },
        resume: vi.fn().mockResolvedValue(),
        close: vi.fn().mockResolvedValue(),
        destination: {},
        state: 'suspended',
      })),
      AudioWorkletNode: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        port: { postMessage: vi.fn(), onmessage: null },
      })),
      WebSocket: vi.fn(() => ({
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1,
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: {
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
      },
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
      fetch: vi.fn(),
    };

    global.Audio = vi.fn(() => ({
      play: vi.fn().mockResolvedValue(),
      pause: vi.fn(),
      src: '',
      currentTime: 0,
      addEventListener: vi.fn(),
    }));

    global.Date = {
      now: vi.fn(() => 1000),
    };

    global.setTimeout = vi.fn((_callback, _delay) => {
      // For tests, don't execute callbacks automatically to prevent infinite loops
      // Tests can manually trigger callbacks if needed
      return 1; // Return a mock timer ID
    });
    global.clearTimeout = vi.fn();
    global.setInterval = vi.fn((_callback, _delay) => 1);
    global.clearInterval = vi.fn();

    // Set up proper style objects for mock elements after globals are set
    Object.keys(mockElements).forEach((key) => {
      if (mockElements[key] && typeof mockElements[key] === 'object') {
        Object.defineProperty(mockElements[key], 'style', {
          value: {
            width: '0%',
            background: '',
            cssText: '',
            setProperty: vi.fn(),
            getPropertyValue: vi.fn(() => ''),
          },
          writable: true,
          configurable: true,
        });

        // Add parentElement for micLevelBar if needed
        if (key === 'micLevelBar') {
          mockElements[key].parentElement = {
            appendChild: vi.fn(),
          };
        }
      }
    });

    // Import and create voiceCoach instance after mocking
    const { default: BulgarianVoiceCoach } = await import('../main.js');
    voiceCoach = new BulgarianVoiceCoach();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Audio Level Initialization', () => {
    it('should initialize audio level history arrays', () => {
      expect(voiceCoach.audioLevelHistory).toEqual([]);
      expect(voiceCoach.audioLevelPeaks).toEqual([]);
      expect(voiceCoach.lastLevelUpdate).toBe(0);
    });
  });

  describe('Audio Level Updates', () => {
    beforeEach(() => {
      voiceCoach.isRecording = false;
    });

    it('should update level bar width with smoothed level', () => {
      voiceCoach.updateAudioLevel(0.5);

      expect(voiceCoach.audioLevelHistory).toContain(0.5);
      expect(mockElements.micLevelBar.style.width).toBe('50%');
    });

    it('should maintain moving average with history limit', () => {
      // Add more than 5 values to test history limit
      for (let i = 0; i < 7; i++) {
        voiceCoach.updateAudioLevel(i * 0.1);
      }

      expect(voiceCoach.audioLevelHistory.length).toBe(5);
      // Use approximate equality for floating-point numbers
      expect(voiceCoach.audioLevelHistory.map((v) => Math.round(v * 10) / 10)).toEqual([
        0.2, 0.3, 0.4, 0.5, 0.6,
      ]);
    });

    it('should calculate correct smoothed percentage', () => {
      voiceCoach.updateAudioLevel(0.2);
      voiceCoach.updateAudioLevel(0.4);
      voiceCoach.updateAudioLevel(0.6);

      // Average should be (0.2 + 0.4 + 0.6) / 3 = 0.4 = 40%
      expect(mockElements.micLevelBar.style.width).toBe('40%');
    });

    it('should cap percentage at 100%', () => {
      voiceCoach.updateAudioLevel(1.5); // Over 100%

      expect(mockElements.micLevelBar.style.width).toBe('100%');
    });
  });

  describe('Dynamic Color Changes', () => {
    it('should use green for low levels (< 20%)', () => {
      voiceCoach.updateAudioLevel(0.1);

      expect(mockElements.micLevelBar.style.background).toBe(
        'linear-gradient(90deg, #4ade80, #4ade80)'
      );
    });

    it('should use green-yellow for medium levels (20-60%)', () => {
      voiceCoach.updateAudioLevel(0.4);

      expect(mockElements.micLevelBar.style.background).toBe(
        'linear-gradient(90deg, #4ade80, #fbbf24)'
      );
    });

    it('should use green-yellow-red for high levels (60-85%)', () => {
      voiceCoach.updateAudioLevel(0.7);

      expect(mockElements.micLevelBar.style.background).toBe(
        'linear-gradient(90deg, #4ade80, #fbbf24, #f87171)'
      );
    });

    it('should use red for very high levels (> 85%)', () => {
      voiceCoach.updateAudioLevel(0.9);

      expect(mockElements.micLevelBar.style.background).toBe(
        'linear-gradient(90deg, #f87171, #ef4444)'
      );
    });
  });

  describe('Peak Detection', () => {
    beforeEach(() => {
      global.Date.now.mockReturnValue(1000);
      voiceCoach.lastLevelUpdate = 0;
    });

    it('should add peak indicator for high levels', () => {
      voiceCoach.updateAudioLevel(0.8); // Above 0.7 threshold

      expect(mockElements.micLevelBar.parentElement.appendChild).toHaveBeenCalled();
      expect(voiceCoach.lastLevelUpdate).toBe(1000);
    });

    it('should not add peak if recent peak was added', () => {
      voiceCoach.lastLevelUpdate = 950; // Recent update
      global.Date.now.mockReturnValue(1000);

      voiceCoach.updateAudioLevel(0.8);

      expect(mockElements.micLevelBar.parentElement.appendChild).not.toHaveBeenCalled();
    });

    it('should throttle peak detection by 100ms', () => {
      voiceCoach.lastLevelUpdate = 950;
      global.Date.now.mockReturnValue(1050); // 100ms later

      voiceCoach.updateAudioLevel(0.8);

      expect(mockElements.micLevelBar.parentElement.appendChild).toHaveBeenCalled();
    });
  });

  describe('Peak Visual Creation', () => {
    it('should create peak element with correct styles', () => {
      const mockPeakElement = {
        className: '',
        style: { cssText: '' },
        parentNode: mockElements.micLevelBar.parentElement,
      };
      global.document.createElement.mockReturnValue(mockPeakElement);

      voiceCoach.addLevelPeak(75);

      expect(mockPeakElement.className).toBe('level-peak');
      expect(mockPeakElement.style.cssText).toContain('left: 75%');
      expect(mockPeakElement.style.cssText).toContain('position: absolute');
      expect(mockPeakElement.style.cssText).toContain(
        'animation: fadeOutPeak 1s ease-out forwards'
      );
    });

    it('should add animation styles only once', () => {
      global.document.querySelector.mockReturnValueOnce(null).mockReturnValueOnce({});

      voiceCoach.addLevelPeak(50);
      voiceCoach.addLevelPeak(60);

      expect(global.document.createElement).toHaveBeenCalledWith('style');
    });

    it('should clean up peak element after animation', () => {
      const mockPeakElement = {
        className: '',
        style: { cssText: '' },
        parentNode: mockElements.micLevelBar.parentElement,
      };
      global.document.createElement.mockReturnValue(mockPeakElement);

      voiceCoach.addLevelPeak(50);

      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('Microphone Status Updates', () => {
    beforeEach(() => {
      voiceCoach.isRecording = true;
    });

    it('should show "speak louder" for very low levels', () => {
      voiceCoach.updateAudioLevel(0.02); // 2%

      expect(mockElements.micStatus.textContent).toBe('Listening... (speak louder)');
    });

    it('should show "very loud" for very high levels', () => {
      voiceCoach.updateAudioLevel(0.9); // 90%

      expect(mockElements.micStatus.textContent).toBe('Listening... (very loud!)');
    });

    it('should show "good level" for optimal levels', () => {
      voiceCoach.updateAudioLevel(0.6); // 60%

      expect(mockElements.micStatus.textContent).toBe('Listening... (good level)');
    });

    it('should show default "Listening..." for moderate levels', () => {
      voiceCoach.updateAudioLevel(0.3); // 30%

      expect(mockElements.micStatus.textContent).toBe('Listening...');
    });

    it('should not update status when not recording', () => {
      voiceCoach.isRecording = false;
      const initialText = mockElements.micStatus.textContent;

      voiceCoach.updateAudioLevel(0.9);

      expect(mockElements.micStatus.textContent).toBe(initialText);
    });
  });

  describe('Legacy Audio Processing', () => {
    it('should calculate audio level from array data', () => {
      const audioData = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5]);

      voiceCoach.processAudioData(audioData);

      // Expected level: (0.1 + 0.2 + 0.3 + 0.4 + 0.5) / 5 = 0.3
      // Amplified by 10: min(1.0, 3.0) = 1.0
      expect(mockElements.micLevelBar.style.width).toBe('100%');
    });

    it('should handle empty audio data', () => {
      const audioData = new Float32Array([]);

      voiceCoach.processAudioData(audioData);

      expect(mockElements.micLevelBar.style.width).toBe('0%');
    });

    it('should amplify weak signals', () => {
      const audioData = new Float32Array([0.01, 0.01, 0.01]);

      voiceCoach.processAudioData(audioData);

      // Level: 0.01 * 10 = 0.1 = 10%
      expect(mockElements.micLevelBar.style.width).toBe('10%');
    });
  });

  describe('Audio Level Integration', () => {
    it('should process worklet messages for level updates', () => {
      const message = {
        type: 'level',
        value: 0.6,
      };

      voiceCoach.handleWorkletMessage(message);

      expect(mockElements.micLevelBar.style.width).toBe('60%');
    });

    it('should ignore non-level messages', () => {
      const message = {
        type: 'audioFrame',
        data: new ArrayBuffer(8),
      };

      voiceCoach.handleWorkletMessage(message);

      expect(mockElements.micLevelBar.style.width).toBe('0%');
    });
  });
});
