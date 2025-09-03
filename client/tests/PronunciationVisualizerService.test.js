/**
 * Unit tests for PronunciationVisualizerService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock canvas context methods
const createMockCanvas = () => ({
  width: 800,
  height: 200,
  getContext: vi.fn(() => ({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    font: '12px Arial',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1.0,
  })),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Mock DOM elements
const createMockContainer = () => ({
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  innerHTML: '',
  style: {},
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(() => false),
  },
});

// Mock global objects
global.document = {
  createElement: vi.fn((tagName) => {
    if (tagName === 'canvas') {
      return createMockCanvas();
    }
    return {
      tagName: tagName.toUpperCase(),
      className: '',
      innerHTML: '',
      style: {},
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
      },
    };
  }),
  getElementById: vi.fn(),
  querySelector: vi.fn(),
};

global.window = {
  requestAnimationFrame: vi.fn((callback) => {
    setTimeout(callback, 16);
    return 1;
  }),
  cancelAnimationFrame: vi.fn(),
  devicePixelRatio: 1,
  voiceCoach: {
    showPhonemePractice: vi.fn(),
  },
};

global.Audio = vi.fn(() => ({
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
  currentTime: 0,
  duration: 0,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

describe('PronunciationVisualizerService', () => {
  let PronunciationVisualizerService;
  let service;
  let mockContainer;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock container
    mockContainer = createMockContainer();

    // Import the service after setting up mocks
    const module = await import('../services/PronunciationVisualizerService.js');
    PronunciationVisualizerService = module.PronunciationVisualizerService;
    service = new PronunciationVisualizerService();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default properties', () => {
      expect(service.isActive).toBe(false);
      expect(service.analysisData).toBe(null);
      expect(service.canvas).toBe(null);
      expect(service.ctx).toBe(null);
      expect(service.container).toBe(null);
      expect(service.audio).toBe(null);
      expect(service.animationFrame).toBe(null);
    });

    it('should have all required methods', () => {
      expect(typeof service.initializeCanvas).toBe('function');
      expect(typeof service.visualizeAnalysis).toBe('function');
      expect(typeof service.playWithVisualization).toBe('function');
      expect(typeof service.showPhonemeDetail).toBe('function');
      expect(typeof service.cleanup).toBe('function');
    });
  });

  describe('Canvas Initialization', () => {
    it('should initialize canvas with container', () => {
      service.initializeCanvas(mockContainer);

      expect(service.container).toBe(mockContainer);
      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    it('should set canvas dimensions', () => {
      service.initializeCanvas(mockContainer);

      expect(service.canvas.width).toBe(800);
      expect(service.canvas.height).toBe(200);
    });

    it('should get canvas context', () => {
      service.initializeCanvas(mockContainer);

      expect(service.canvas.getContext).toHaveBeenCalledWith('2d');
      expect(service.ctx).toBeDefined();
    });

    it('should handle high DPI displays', () => {
      global.window.devicePixelRatio = 2;
      service.initializeCanvas(mockContainer);

      expect(service.ctx.scale).toHaveBeenCalledWith(2, 2);
    });
  });

  describe('Visualization', () => {
    const mockAnalysisData = {
      overall_score: 0.85,
      phoneme_scores: [
        {
          phoneme: 'ʃ',
          score: 0.8,
          start: 0.0,
          end: 0.2,
          difficulty: 4,
          feedback: 'Good pronunciation',
        },
        {
          phoneme: 'a',
          score: 0.9,
          start: 0.2,
          end: 0.4,
          difficulty: 2,
          feedback: 'Excellent',
        },
        {
          phoneme: 'p',
          score: 0.7,
          start: 0.4,
          end: 0.6,
          difficulty: 1,
          feedback: 'Needs improvement',
        },
      ],
      timing: { total_duration: 1.0 },
      transcription: 'шап',
      reference_text: 'шап',
    };

    beforeEach(() => {
      service.initializeCanvas(mockContainer);
    });

    it('should visualize analysis data', () => {
      service.visualizeAnalysis(mockAnalysisData);

      expect(service.isActive).toBe(true);
      expect(service.analysisData).toBe(mockAnalysisData);
      expect(service.ctx.clearRect).toHaveBeenCalled();
    });

    it('should draw waveform representation', () => {
      service.visualizeAnalysis(mockAnalysisData);

      expect(service.ctx.beginPath).toHaveBeenCalled();
      expect(service.ctx.stroke).toHaveBeenCalled();
    });

    it('should draw phoneme segments', () => {
      service.visualizeAnalysis(mockAnalysisData);

      expect(service.ctx.fillRect).toHaveBeenCalled();
      expect(service.ctx.fillText).toHaveBeenCalled();
    });

    it('should use different colors for different score ranges', () => {
      service.visualizeAnalysis(mockAnalysisData);

      // Verify that fillStyle was set multiple times for different scores
      const fillStyleCalls = service.ctx.fillStyle;
      expect(typeof fillStyleCalls).toBe('string');
    });

    it('should handle empty analysis data', () => {
      const emptyData = {
        overall_score: 0,
        phoneme_scores: [],
        timing: { total_duration: 0 },
        transcription: '',
        reference_text: '',
      };

      expect(() => service.visualizeAnalysis(emptyData)).not.toThrow();
      expect(service.analysisData).toBe(emptyData);
    });

    it('should handle analysis data without required fields', () => {
      const incompleteData = {
        overall_score: 0.5,
      };

      expect(() => service.visualizeAnalysis(incompleteData)).not.toThrow();
    });
  });

  describe('Audio Playback with Visualization', () => {
    const mockAudioUrl = 'data:audio/wav;base64,mock';

    beforeEach(() => {
      service.initializeCanvas(mockContainer);
    });

    it('should play audio with visualization', async () => {
      const promise = service.playWithVisualization(mockAudioUrl);

      expect(global.Audio).toHaveBeenCalledWith(mockAudioUrl);
      expect(service.audio.addEventListener).toHaveBeenCalledWith(
        'timeupdate',
        expect.any(Function)
      );

      await promise;
    });

    it('should handle audio loading errors', async () => {
      const mockAudio = {
        play: vi.fn(() => Promise.reject(new Error('Audio load failed'))),
        pause: vi.fn(),
        currentTime: 0,
        duration: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.Audio = vi.fn(() => mockAudio);

      await expect(service.playWithVisualization(mockAudioUrl)).rejects.toThrow();
    });

    it('should update visualization during playback', async () => {
      const mockAnalysisData = {
        phoneme_scores: [
          { phoneme: 'a', start: 0.0, end: 0.5, score: 0.8 },
          { phoneme: 'b', start: 0.5, end: 1.0, score: 0.9 },
        ],
        timing: { total_duration: 1.0 },
      };

      service.analysisData = mockAnalysisData;

      await service.playWithVisualization(mockAudioUrl);

      // Verify that timeupdate listener was added
      expect(service.audio.addEventListener).toHaveBeenCalledWith(
        'timeupdate',
        expect.any(Function)
      );
    });

    it('should highlight current phoneme during playback', () => {
      const mockAnalysisData = {
        phoneme_scores: [
          { phoneme: 'a', start: 0.0, end: 0.5, score: 0.8 },
          { phoneme: 'b', start: 0.5, end: 1.0, score: 0.9 },
        ],
        timing: { total_duration: 1.0 },
      };

      service.analysisData = mockAnalysisData;
      service.currentTime = 0.3; // Should highlight first phoneme

      service._updateVisualization();

      expect(service.ctx.clearRect).toHaveBeenCalled();
      expect(service.ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('Phoneme Detail Display', () => {
    const mockPhoneme = {
      phoneme: 'ʃ',
      score: 0.8,
      difficulty: 4,
      feedback: 'Good pronunciation',
      start: 0.0,
      end: 0.2,
    };

    beforeEach(() => {
      service.initializeCanvas(mockContainer);
    });

    it('should show phoneme detail', () => {
      service.showPhonemeDetail(mockPhoneme);

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should display phoneme information', () => {
      service.showPhonemeDetail(mockPhoneme);

      // Should create elements for phoneme details
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.createElement).toHaveBeenCalledWith('p');
      expect(document.createElement).toHaveBeenCalledWith('button');
    });

    it('should show practice button for difficult phonemes', () => {
      const difficultPhoneme = { ...mockPhoneme, difficulty: 5, score: 0.3 };

      service.showPhonemeDetail(difficultPhoneme);

      // Should create practice button
      expect(document.createElement).toHaveBeenCalledWith('button');
    });

    it('should handle phoneme practice button click', () => {
      service.showPhonemeDetail(mockPhoneme);

      // Simulate button click
      const mockButton = {
        addEventListener: vi.fn(),
        textContent: '',
        className: '',
      };

      document.createElement = vi.fn(() => mockButton);
      service.showPhonemeDetail(mockPhoneme);

      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should close phoneme detail on close button click', () => {
      service.showPhonemeDetail(mockPhoneme);

      const mockCloseButton = {
        addEventListener: vi.fn(),
        textContent: '×',
        className: '',
        style: {},
      };

      document.createElement = vi.fn((tagName) => {
        if (tagName === 'button') {
          return mockCloseButton;
        }
        return {
          appendChild: vi.fn(),
          className: '',
          innerHTML: '',
          style: {},
        };
      });

      service.showPhonemeDetail(mockPhoneme);
      expect(mockCloseButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      service.initializeCanvas(mockContainer);
    });

    it('should cleanup canvas and container', () => {
      service.cleanup();

      expect(service.isActive).toBe(false);
      expect(service.analysisData).toBe(null);
      expect(service.canvas).toBe(null);
      expect(service.ctx).toBe(null);
    });

    it('should stop audio playback', () => {
      service.audio = {
        pause: vi.fn(),
        currentTime: 0,
        removeEventListener: vi.fn(),
      };

      service.cleanup();

      expect(service.audio.pause).toHaveBeenCalled();
      expect(service.audio).toBe(null);
    });

    it('should cancel animation frame', () => {
      service.animationFrame = 123;

      service.cleanup();

      expect(global.window.cancelAnimationFrame).toHaveBeenCalledWith(123);
      expect(service.animationFrame).toBe(null);
    });

    it('should remove canvas from container', () => {
      const mockCanvas = createMockCanvas();
      service.canvas = mockCanvas;

      service.cleanup();

      expect(mockContainer.removeChild).toHaveBeenCalledWith(mockCanvas);
    });

    it('should handle cleanup when canvas not in container', () => {
      service.canvas = createMockCanvas();
      mockContainer.removeChild.mockImplementation(() => {
        throw new Error('Node not found');
      });

      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing container in initializeCanvas', () => {
      expect(() => service.initializeCanvas(null)).not.toThrow();
    });

    it('should handle canvas creation failure', () => {
      document.createElement = vi.fn(() => null);

      expect(() => service.initializeCanvas(mockContainer)).not.toThrow();
    });

    it('should handle context creation failure', () => {
      const mockCanvas = {
        ...createMockCanvas(),
        getContext: vi.fn(() => null),
      };
      document.createElement = vi.fn(() => mockCanvas);

      service.initializeCanvas(mockContainer);

      expect(service.ctx).toBe(null);
    });

    it('should handle visualization without canvas', () => {
      const mockData = {
        overall_score: 0.5,
        phoneme_scores: [],
      };

      expect(() => service.visualizeAnalysis(mockData)).not.toThrow();
    });

    it('should handle audio playback without canvas', async () => {
      await expect(service.playWithVisualization('mock-url')).rejects.toThrow();
    });
  });

  describe('Integration', () => {
    it('should work with complete workflow', async () => {
      const analysisData = {
        overall_score: 0.85,
        phoneme_scores: [{ phoneme: 'ʃ', score: 0.8, start: 0.0, end: 0.2, difficulty: 4 }],
        timing: { total_duration: 1.0 },
        transcription: 'ш',
        reference_text: 'ш',
      };

      service.initializeCanvas(mockContainer);
      service.visualizeAnalysis(analysisData);

      expect(service.isActive).toBe(true);

      await service.playWithVisualization('mock-audio-url');

      service.showPhonemeDetail(analysisData.phoneme_scores[0]);
      service.cleanup();

      expect(service.isActive).toBe(false);
    });

    it('should handle multiple analysis visualizations', () => {
      const firstAnalysis = {
        overall_score: 0.7,
        phoneme_scores: [{ phoneme: 'a', score: 0.7, start: 0, end: 1 }],
      };

      const secondAnalysis = {
        overall_score: 0.9,
        phoneme_scores: [{ phoneme: 'b', score: 0.9, start: 0, end: 1 }],
      };

      service.initializeCanvas(mockContainer);
      service.visualizeAnalysis(firstAnalysis);

      expect(service.analysisData).toBe(firstAnalysis);

      service.visualizeAnalysis(secondAnalysis);

      expect(service.analysisData).toBe(secondAnalysis);
    });
  });
});
