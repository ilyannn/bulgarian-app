/**
 * @fileoverview Tests for warm-up drills functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Global mocks needed before main.js import
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

describe('Warm-up Drills', () => {
  let voiceCoach;
  let mockElements;

  beforeEach(async () => {
    // Mock DOM elements
    mockElements = {
      transcriptArea: {
        innerHTML: '',
        appendChild: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
      },
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

    // Mock global objects
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
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
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

  describe('User ID Generation', () => {
    it('should generate a new user ID when none exists', () => {
      global.window.localStorage.getItem.mockReturnValue(null);

      const userId = voiceCoach.getUserId();

      expect(userId).toMatch(/^user_[a-z0-9]{7}$/);
      expect(global.window.localStorage.setItem).toHaveBeenCalledWith(
        'bulgarian_coach_user_id',
        userId
      );
    });

    it('should return existing user ID from localStorage', () => {
      const existingUserId = 'user_abc123def';

      // Clear previous mock calls and set up fresh mock
      global.window.localStorage.getItem.mockClear();
      global.window.localStorage.setItem.mockClear();
      global.window.localStorage.getItem.mockReturnValue(existingUserId);

      const userId = voiceCoach.getUserId();

      expect(userId).toBe(existingUserId);
      expect(global.window.localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Loading Warm-up Drills', () => {
    beforeEach(() => {
      voiceCoach.getUserId = vi.fn().mockReturnValue('user_test123');
      voiceCoach.displayWarmupDrills = vi.fn();
      voiceCoach.displayWelcomeMessage = vi.fn();
    });

    it('should load and display warm-up drills when items are due', async () => {
      const mockDueItems = ['bg.no_infinitive.da_present', 'bg.definite_article.postposed'];

      global.window.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDueItems),
      });

      await voiceCoach.loadWarmupDrills();

      expect(global.window.fetch).toHaveBeenCalledWith(
        '/progress/due-items?user_id=user_test123&limit=3'
      );
      expect(voiceCoach.displayWarmupDrills).toHaveBeenCalledWith(mockDueItems);
    });

    it('should display welcome message when no items are due', async () => {
      global.window.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await voiceCoach.loadWarmupDrills();

      expect(voiceCoach.displayWelcomeMessage).toHaveBeenCalled();
      expect(voiceCoach.displayWarmupDrills).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      global.window.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      console.warn = vi.fn();
      await voiceCoach.loadWarmupDrills();

      expect(console.warn).toHaveBeenCalledWith('Could not load warm-up drills:', 'Server Error');
      expect(voiceCoach.displayWelcomeMessage).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      global.window.fetch.mockRejectedValue(new Error('Network error'));

      console.warn = vi.fn();
      await voiceCoach.loadWarmupDrills();

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to load warm-up drills:',
        expect.any(Error)
      );
      expect(voiceCoach.displayWelcomeMessage).toHaveBeenCalled();
    });
  });

  describe('Displaying Warm-up Drills', () => {
    it('should render warm-up drills with correct HTML structure', () => {
      const dueItems = ['bg.no_infinitive.da_present', 'bg.definite_article.postposed'];
      mockElements.transcriptArea.querySelectorAll = vi.fn(() => [
        { addEventListener: vi.fn(), getAttribute: vi.fn() },
        { addEventListener: vi.fn(), getAttribute: vi.fn() },
      ]);

      voiceCoach.displayWarmupDrills(dueItems);

      expect(mockElements.transcriptArea.innerHTML).toContain('Warm-up Practice');
      expect(mockElements.transcriptArea.innerHTML).toContain('2 grammar items due for review');
      expect(mockElements.transcriptArea.innerHTML).toContain('bg.no_infinitive.da_present');
      expect(mockElements.transcriptArea.innerHTML).toContain('bg.definite_article.postposed');
    });

    it('should handle singular grammar item correctly', () => {
      const dueItems = ['bg.no_infinitive.da_present'];
      mockElements.transcriptArea.querySelectorAll = vi.fn(() => [
        { addEventListener: vi.fn(), getAttribute: vi.fn() },
      ]);

      voiceCoach.displayWarmupDrills(dueItems);

      expect(mockElements.transcriptArea.innerHTML).toContain('1 grammar item due for review');
    });

    it('should add event listeners to practice buttons', () => {
      const dueItems = ['bg.no_infinitive.da_present'];
      const mockButton = {
        addEventListener: vi.fn(),
        getAttribute: vi.fn().mockReturnValue('bg.no_infinitive.da_present'),
      };
      mockElements.transcriptArea.querySelectorAll = vi.fn(() => [mockButton]);
      voiceCoach.startGrammarPractice = vi.fn();

      voiceCoach.displayWarmupDrills(dueItems);

      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Simulate click
      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler({ target: mockButton });

      expect(voiceCoach.startGrammarPractice).toHaveBeenCalledWith('bg.no_infinitive.da_present');
    });
  });

  describe('Welcome Message Display', () => {
    it('should display welcome message with correct content', () => {
      voiceCoach.displayWelcomeMessage();

      expect(mockElements.transcriptArea.innerHTML).toContain('Welcome to Bulgarian Voice Coach!');
      expect(mockElements.transcriptArea.innerHTML).toContain(
        "You're all caught up with your reviews"
      );
      expect(mockElements.transcriptArea.innerHTML).toContain('Start speaking to begin practicing');
    });
  });

  describe('Grammar Practice Startup', () => {
    beforeEach(() => {
      voiceCoach.showError = vi.fn();
      voiceCoach.showToast = vi.fn();
    });

    it('should start grammar practice with available drills', async () => {
      const mockDrills = [
        {
          prompt: 'Transform: Аз искам да ям.',
          expected_answer: 'Аз искам да хапна.',
          type: 'transform',
        },
      ];

      global.window.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDrills),
      });

      await voiceCoach.startGrammarPractice('bg.no_infinitive.da_present');

      expect(global.window.fetch).toHaveBeenCalledWith(
        '/content/drills/bg.no_infinitive.da_present'
      );
      expect(mockElements.transcriptArea.innerHTML).toContain(
        'Quick Practice: bg.no_infinitive.da_present'
      );
      expect(mockElements.transcriptArea.innerHTML).toContain('Transform: Аз искам да ям.');
      expect(mockElements.transcriptArea.innerHTML).toContain('Answer: "Аз искам да хапна."');
    });

    it('should handle case when no drills are available', async () => {
      global.window.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await voiceCoach.startGrammarPractice('bg.no_infinitive.da_present');

      expect(voiceCoach.showToast).toHaveBeenCalledWith(
        'No practice drills available for this grammar item',
        'info'
      );
    });

    it('should handle API errors when loading drills', async () => {
      global.window.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await voiceCoach.startGrammarPractice('invalid.grammar.id');

      expect(voiceCoach.showError).toHaveBeenCalledWith('Could not load practice drills');
    });

    it('should handle network errors when loading drills', async () => {
      global.window.fetch.mockRejectedValue(new Error('Network failed'));
      console.error = vi.fn();

      await voiceCoach.startGrammarPractice('bg.no_infinitive.da_present');

      expect(console.error).toHaveBeenCalledWith(
        'Failed to start grammar practice:',
        expect.any(Error)
      );
      expect(voiceCoach.showError).toHaveBeenCalledWith('Could not start practice session');
    });
  });
});
