/**
 * @fileoverview Tests for error highlighting in transcripts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Global mocks needed before main.js import
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

// Mock Date constructor for timestamp generation
global.Date = class extends Date {
  constructor(...args) {
    if (args.length === 0) {
      super('2025-01-01T12:00:00Z');
    } else {
      super(...args);
    }
  }

  toLocaleTimeString() {
    return '12:00 PM';
  }
};

describe('Error Highlighting', () => {
  let voiceCoach;
  let mockElements;

  beforeEach(async () => {
    // Enhanced mock for document with proper DOM element methods (define before mockElements)
    const createMockElement = () => {
      const element = {
        className: '',
        innerHTML: '',
        textContent: '',
        style: {},
        children: [],
        appendChild: vi.fn(function (child) {
          this.children.push(child);
          return child;
        }),
        querySelector: vi.fn((_selector) => createMockElement()),
        querySelectorAll: vi.fn(() => []),
        remove: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
          toggle: vi.fn(),
        },
      };
      return element;
    };

    // Mock DOM elements
    mockElements = {
      transcriptArea: createMockElement(),
      micButton: { addEventListener: vi.fn() },
      clearBtn: { addEventListener: vi.fn() },
      playLastBtn: { addEventListener: vi.fn() },
      playPauseBtn: { addEventListener: vi.fn(), disabled: false },
      replayBtn: { addEventListener: vi.fn(), disabled: false },
      stopBtn: { addEventListener: vi.fn(), disabled: false },
      connectionStatus: {},
      audioStatus: {},
      latencyText: {},
      micStatus: {},
      micLevelBar: { style: { width: '0%' } },
      micPanel: { classList: { add: vi.fn(), remove: vi.fn() } },
      connectionText: {},
      audioText: {},
    };

    // Mock global objects (using createMockElement from above)
    global.document = {
      getElementById: vi.fn(
        (id) =>
          mockElements[id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] ||
          createMockElement()
      ),
      addEventListener: vi.fn(),
      querySelector: vi.fn(() => createMockElement()),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn((_tag) => createMockElement()),
      createTextNode: vi.fn((text) => ({ textContent: text, nodeType: 3 })),
      head: createMockElement(),
      body: createMockElement(),
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

    // Import and create voiceCoach instance after mocking
    const { default: BulgarianVoiceCoach } = await import('../main.js');
    voiceCoach = new BulgarianVoiceCoach();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Class Mapping', () => {
    it('should map error types to correct CSS classes', () => {
      expect(voiceCoach.getErrorClass('grammar')).toBe('grammar');
      expect(voiceCoach.getErrorClass('agreement')).toBe('agreement');
      expect(voiceCoach.getErrorClass('article')).toBe('article');
      expect(voiceCoach.getErrorClass('case')).toBe('case');
      expect(voiceCoach.getErrorClass('tense')).toBe('tense');
      expect(voiceCoach.getErrorClass('spelling')).toBe('spelling');
      expect(voiceCoach.getErrorClass('vocab')).toBe('vocab');
    });

    it('should return general class for unknown error types', () => {
      expect(voiceCoach.getErrorClass('unknown')).toBe('general');
      expect(voiceCoach.getErrorClass(null)).toBe('general');
      expect(voiceCoach.getErrorClass(undefined)).toBe('general');
    });
  });

  describe('Error Highlighting Function', () => {
    it('should return original text when no corrections provided', () => {
      const text = 'Аз искам да ям хляб.';

      expect(voiceCoach.highlightErrors(text, null)).toBe(text);
      expect(voiceCoach.highlightErrors(text, [])).toBe(text);
      expect(voiceCoach.highlightErrors(text, undefined)).toBe(text);
    });

    it('should highlight single error correctly', () => {
      const text = 'Аз искам да ям хляб.';
      const corrections = [
        {
          before: 'ям',
          after: 'хапна',
          type: 'grammar',
        },
      ];

      const result = voiceCoach.highlightErrors(text, corrections);

      expect(result).toContain('<span class="error-highlight error-grammar"');
      expect(result).toContain('title="grammar: ям → хапна"');
      expect(result).toContain('ям');
      expect(result).toContain('<span class="error-tooltip">');
      expect(result).toContain('<strong>grammar:</strong>');
      expect(result).toContain('ям → <span class="error-correction">хапна</span>');
    });

    it('should highlight multiple errors correctly', () => {
      const text = 'Аз искам да ям голям хляб.';
      const corrections = [
        {
          before: 'ям',
          after: 'хапна',
          type: 'grammar',
        },
        {
          before: 'голям',
          after: 'голям',
          type: 'agreement',
        },
      ];

      const result = voiceCoach.highlightErrors(text, corrections);

      expect(result).toContain('error-grammar');
      expect(result).toContain('error-agreement');
      expect(result).toContain('ям → хапна');
      expect(result).toContain('голям → голям');
    });

    it('should handle corrections with position information', () => {
      const text = 'Аз искам да ям хляб.';
      const corrections = [
        {
          before: 'ям',
          after: 'хапна',
          type: 'grammar',
          position: { start: 12, end: 14 },
        },
      ];

      const result = voiceCoach.highlightErrors(text, corrections);

      expect(result).toContain('<span class="error-highlight error-grammar"');
    });

    it('should sort corrections by position to avoid overlap', () => {
      const text = 'Аз ще да ям хляб утре.';
      const corrections = [
        {
          before: 'ще да',
          after: 'ще',
          type: 'tense',
          position: { start: 3, end: 8 },
        },
        {
          before: 'ям',
          after: 'ям',
          type: 'grammar',
          position: { start: 9, end: 11 },
        },
      ];

      const result = voiceCoach.highlightErrors(text, corrections);

      // Should contain both highlights without breaking the text
      expect(result).toContain('error-tense');
      expect(result).toContain('error-grammar');
    });

    it('should skip corrections that do not match the text', () => {
      const text = 'Аз искам да ям хляб.';
      const corrections = [
        {
          before: 'не съществува',
          after: 'също не съществува',
          type: 'grammar',
        },
      ];

      const result = voiceCoach.highlightErrors(text, corrections);

      expect(result).toBe(text); // Should remain unchanged
    });
  });

  describe('Final Transcript with Error Highlighting', () => {
    beforeEach(() => {
      voiceCoach.scrollToBottom = vi.fn();
    });

    it('should add final transcript with error highlighting', () => {
      const mockElement = {
        className: '',
        innerHTML: '',
      };
      global.document.createElement.mockReturnValue(mockElement);

      voiceCoach.lastDetectedErrors = [
        {
          before: 'ям',
          after: 'хапна',
          type: 'grammar',
        },
      ];

      voiceCoach.addFinalTranscript('Аз искам да ям хляб.');

      expect(mockElement.className).toBe('transcript-line final');
      expect(mockElement.innerHTML).toContain('<strong>You:</strong>');
      expect(mockElement.innerHTML).toContain('error-highlight error-grammar');
      expect(mockElements.transcriptArea.appendChild).toHaveBeenCalledWith(mockElement);
      expect(voiceCoach.scrollToBottom).toHaveBeenCalled();
    });

    it('should handle final transcript without errors', () => {
      const mockElement = {
        className: '',
        innerHTML: '',
      };
      global.document.createElement.mockReturnValue(mockElement);

      voiceCoach.lastDetectedErrors = [];

      voiceCoach.addFinalTranscript('Здравей, как си?');

      expect(mockElement.innerHTML).toContain('Здравей, как си?');
      expect(mockElement.innerHTML).not.toContain('error-highlight');
    });
  });

  describe('Coach Response with Error Storage', () => {
    beforeEach(() => {
      voiceCoach.scrollToBottom = vi.fn();
      voiceCoach.enableAudioControls = vi.fn();
      global.window.grammarChipsUI = {
        createChips: vi.fn(),
      };
    });

    it('should store corrections from coach response', () => {
      const payload = {
        reply_bg: 'Добре, но трябва да кажеш "хапна" вместо "ям".',
        corrections: [
          {
            before: 'ям',
            after: 'хапна',
            type: 'grammar',
          },
        ],
      };

      voiceCoach.addCoachResponse(payload);

      expect(voiceCoach.lastDetectedErrors).toEqual(payload.corrections);
    });

    it('should handle coach response without corrections', () => {
      const payload = {
        reply_bg: 'Много добре!',
      };

      voiceCoach.addCoachResponse(payload);

      expect(voiceCoach.lastDetectedErrors).toEqual([]);
    });

    it('should create grammar chips when available', () => {
      const payload = {
        reply_bg: 'Добре, но има грешка.',
        corrections: [
          {
            before: 'ям',
            after: 'хапна',
            type: 'grammar',
          },
        ],
      };

      const mockElement = {
        className: '',
        innerHTML: '',
      };
      global.document.createElement.mockReturnValue(mockElement);

      voiceCoach.addCoachResponse(payload);

      expect(global.window.grammarChipsUI.createChips).toHaveBeenCalledWith(
        payload.corrections,
        mockElement
      );
    });
  });

  describe('Error Highlighting Integration', () => {
    it('should integrate error highlighting with transcript flow', () => {
      // Simulate coach response with corrections
      const corrections = [
        {
          before: 'ям',
          after: 'хапна',
          type: 'grammar',
        },
      ];

      voiceCoach.addCoachResponse({
        reply_bg: 'Има грешка тук.',
        corrections: corrections,
      });

      expect(voiceCoach.lastDetectedErrors).toEqual(corrections);

      // Now simulate final transcript that should highlight the error
      const mockFinalElement = {
        className: '',
        innerHTML: '',
      };
      global.document.createElement.mockReturnValue(mockFinalElement);

      voiceCoach.addFinalTranscript('Аз искам да ям хляб.');

      expect(mockFinalElement.innerHTML).toContain('error-highlight error-grammar');
      expect(mockFinalElement.innerHTML).toContain('title="grammar: ям → хапна"');
    });
  });
});
