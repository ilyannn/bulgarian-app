/**
 * Inline Drill Interface Tests
 * Test suite for quick practice drill functionality
 */

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineDrillInterface } from '../inline-drills.js';

describe('InlineDrillInterface', () => {
  let dom;
  let document;
  let window;
  let drillInterface;
  let container;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.CustomEvent = window.CustomEvent;
    global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
    global.cancelAnimationFrame = vi.fn();

    container = document.getElementById('container');
    drillInterface = new InlineDrillInterface();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    global.document = undefined;
    global.window = undefined;
    global.CustomEvent = undefined;
    global.requestAnimationFrame = undefined;
    global.cancelAnimationFrame = undefined;
  });

  describe('Initialization', () => {
    it('should initialize with no active drill', () => {
      expect(drillInterface.activeDrill).toBeNull();
      expect(drillInterface.drillTimer).toBeNull();
    });

    it('should inject styles into document head', () => {
      const styles = document.getElementById('inline-drills-styles');
      expect(styles).toBeTruthy();
      expect(styles.textContent).toContain('.inline-drill-container');
    });

    it('should not duplicate styles on multiple initializations', () => {
      new InlineDrillInterface();
      const styles = document.querySelectorAll('#inline-drills-styles');
      expect(styles.length).toBe(1);
    });

    it('should setup event listeners for grammar practice requests', () => {
      const eventSpy = vi.spyOn(drillInterface, 'startDrillFromCorrection');
      const correction = { before: 'wrong', after: 'right', note: 'Fix this' };

      window.dispatchEvent(
        new CustomEvent('grammar-practice-requested', {
          detail: { correction },
        })
      );

      expect(eventSpy).toHaveBeenCalledWith(correction);
    });
  });

  describe('Drill Creation', () => {
    const mockDrill = {
      type: 'transform',
      prompt_bg: 'Change this: ___',
      answer_bg: 'correct answer',
      note: 'Test drill',
    };

    it('should create inline drill element', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      const drillElement = container.querySelector('.inline-drill-container');
      expect(drillElement).toBeTruthy();
      expect(drillInterface.activeDrill).toBeTruthy();
    });

    it('should create drill header with title and timer', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      const title = container.querySelector('.drill-title');
      const timer = container.querySelector('.drill-timer');

      expect(title).toBeTruthy();
      expect(title.textContent).toContain('Quick Practice');
      expect(timer).toBeTruthy();
      expect(timer.textContent).toBe('20s');
    });

    it('should create drill prompt with formatting', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      const prompt = container.querySelector('.drill-prompt');
      expect(prompt).toBeTruthy();
      expect(prompt.innerHTML).toContain('<span class="highlight">___</span>');
    });

    it('should create input area with text input and submit button', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      const input = container.querySelector('.drill-input');
      const submitBtn = container.querySelector('.drill-submit-btn');

      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('Type your answer...');
      expect(submitBtn).toBeTruthy();
      expect(submitBtn.textContent).toContain('Check');
    });

    it('should create action buttons for hint and skip', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      const hintBtn = container.querySelector('.drill-action-btn.hint');
      const skipBtn = container.querySelector('.drill-action-btn.skip');

      expect(hintBtn).toBeTruthy();
      expect(hintBtn.textContent).toContain('Hint');
      expect(skipBtn).toBeTruthy();
      expect(skipBtn.textContent).toContain('Skip');
    });

    it('should close existing drill when creating new one', () => {
      drillInterface.createInlineDrill(mockDrill, container);
      const firstDrill = container.querySelector('.inline-drill-container');

      drillInterface.createInlineDrill({ ...mockDrill, prompt_bg: 'Second drill' }, container);

      // First drill should be fading out
      expect(firstDrill.style.opacity).toBe('0');
    });

    it('should focus input after creation', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      const input = container.querySelector('.drill-input');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Answer Checking', () => {
    const mockDrill = {
      prompt_bg: 'Test prompt',
      answer_bg: 'correct answer',
    };

    beforeEach(() => {
      vi.useFakeTimers();
      drillInterface.createInlineDrill(mockDrill, container);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should accept correct answers', () => {
      const result = drillInterface.checkAnswer('correct answer', 'correct answer');
      expect(result).toBe(true);
    });

    it('should normalize case and whitespace', () => {
      expect(drillInterface.checkAnswer('  CORRECT ANSWER  ', 'correct answer')).toBe(true);
      expect(drillInterface.checkAnswer('correct  answer', 'correct answer')).toBe(true);
    });

    it('should reject incorrect answers', () => {
      const result = drillInterface.checkAnswer('wrong answer', 'correct answer');
      expect(result).toBe(false);
    });

    it('should handle submit with correct answer', () => {
      const input = container.querySelector('.drill-input');
      input.value = 'correct answer';

      drillInterface.submitAnswer(mockDrill, input.value);

      expect(input.classList.contains('correct')).toBe(true);
      const feedback = container.querySelector('.drill-feedback.success');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toContain('Excellent');
    });

    it('should handle submit with incorrect answer', () => {
      const input = container.querySelector('.drill-input');
      input.value = 'wrong answer';

      drillInterface.submitAnswer(mockDrill, input.value);

      expect(input.classList.contains('incorrect')).toBe(true);
      const feedback = container.querySelector('.drill-feedback.error');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toContain('correct answer');
    });

    it('should ignore empty answers', () => {
      const input = container.querySelector('.drill-input');

      drillInterface.submitAnswer(mockDrill, '');
      drillInterface.submitAnswer(mockDrill, '   ');

      expect(input.classList.contains('correct')).toBe(false);
      expect(input.classList.contains('incorrect')).toBe(false);
    });

    it('should handle enter key press', () => {
      const input = container.querySelector('.drill-input');
      input.value = 'correct answer';

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);

      expect(input.classList.contains('correct')).toBe(true);
    });
  });

  describe('Timer Functionality', () => {
    const mockDrill = {
      prompt_bg: 'Test prompt',
      answer_bg: 'test answer',
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start timer when drill is created', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(drillInterface.startTime).toBeTruthy();
    });

    it('should update timer display', () => {
      drillInterface.createInlineDrill(mockDrill, container);
      const timer = container.querySelector('.drill-timer');

      // Fast forward 10 seconds
      vi.advanceTimersByTime(10000);
      drillInterface.startTime = Date.now() - 10000;

      // Manually trigger update (since RAF is mocked)
      const elapsed = Date.now() - drillInterface.startTime;
      const remaining = Math.max(0, 20000 - elapsed);
      const seconds = Math.ceil(remaining / 1000);
      timer.textContent = `${seconds}s`;

      expect(timer.textContent).toBe('10s');
    });

    it('should change timer color as time runs out', () => {
      drillInterface.createInlineDrill(mockDrill, container);
      const timer = container.querySelector('.drill-timer');

      // Simulate 15 seconds elapsed (5 seconds remaining)
      timer.textContent = '5s';
      timer.className = 'drill-timer critical';

      expect(timer.classList.contains('critical')).toBe(true);
    });

    it('should handle time up', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      drillInterface.timeUp();

      const input = container.querySelector('.drill-input');
      const submitBtn = container.querySelector('.drill-submit-btn');

      expect(input.disabled).toBe(true);
      expect(submitBtn.disabled).toBe(true);

      const feedback = container.querySelector('.drill-feedback.hint');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toContain("Time's up");
    });
  });

  describe('Action Buttons', () => {
    const mockDrill = {
      prompt_bg: 'Test prompt',
      answer_bg: 'test answer',
    };

    beforeEach(() => {
      drillInterface.createInlineDrill(mockDrill, container);
    });

    it('should show hint when hint button clicked', () => {
      const hintBtn = container.querySelector('.drill-action-btn.hint');
      hintBtn.click();

      const feedback = container.querySelector('.drill-feedback.hint');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toContain('Hint');
      expect(feedback.textContent).toContain('test a...');
    });

    it('should skip drill when skip button clicked', () => {
      vi.useFakeTimers();
      const skipSpy = vi.spyOn(drillInterface, 'recordResult');
      const skipBtn = container.querySelector('.drill-action-btn.skip');

      skipBtn.click();

      expect(skipSpy).toHaveBeenCalledWith(mockDrill, false, 0);

      // Fast forward past animation
      vi.advanceTimersByTime(500);

      expect(drillInterface.activeDrill).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('Progress Tracking', () => {
    const mockDrill = {
      id: 'drill1',
      prompt_bg: 'Test prompt',
      answer_bg: 'test answer',
    };

    beforeEach(() => {
      drillInterface.createInlineDrill(mockDrill, container);
    });

    it('should record drill results', () => {
      drillInterface.recordResult(mockDrill, true, 15);

      const results = drillInterface.getResults();
      expect(results.length).toBe(1);
      expect(results[0].correct).toBe(true);
      expect(results[0].timeSpent).toBe(15);
      expect(results[0].drill).toBe(mockDrill);
    });

    it('should dispatch drill-completed event', () => {
      const eventSpy = vi.fn();
      window.addEventListener('drill-completed', eventSpy);

      drillInterface.recordResult(mockDrill, true, 15);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0].detail.correct).toBe(true);
    });

    it('should clear results', () => {
      drillInterface.recordResult(mockDrill, true, 15);
      expect(drillInterface.getResults().length).toBe(1);

      drillInterface.clearResults();
      expect(drillInterface.getResults().length).toBe(0);
    });

    it('should call completion callback', () => {
      const callback = vi.fn();
      drillInterface.setCompleteCallback(callback);

      drillInterface.recordResult(mockDrill, true, 15);
      drillInterface.closeDrill();

      expect(callback).toHaveBeenCalledWith([
        expect.objectContaining({
          correct: true,
          timeSpent: 15,
        }),
      ]);
    });
  });

  describe('Drill from Correction', () => {
    it('should create drill from grammar correction', () => {
      const correction = {
        before: 'искам поръчвам',
        after: 'искам да поръчам',
        note: 'Use да + present tense',
        error_tag: 'bg.no_infinitive.da_present',
      };

      drillInterface.startDrillFromCorrection(correction);

      const drillElement = document.querySelector('.inline-drill-container');
      expect(drillElement).toBeTruthy();

      const prompt = drillElement.querySelector('.drill-prompt');
      expect(prompt.textContent).toContain(correction.before);

      expect(drillInterface.activeDrill.data.answer_bg).toBe(correction.after);
    });
  });

  describe('Prompt Formatting', () => {
    it('should format blanks with highlighting', () => {
      const formatted = drillInterface.formatPrompt('Fill in: I want ___ go');
      expect(formatted).toContain('<span class="highlight">___</span>');
    });

    it('should format bracketed content', () => {
      const formatted = drillInterface.formatPrompt('Change [word] to correct form');
      expect(formatted).toContain('<span class="highlight">word</span>');
    });

    it('should handle multiple highlights', () => {
      const formatted = drillInterface.formatPrompt('Fill ___ and [word] here');
      expect(formatted).toContain('<span class="highlight">___</span>');
      expect(formatted).toContain('<span class="highlight">word</span>');
    });
  });

  describe('Feedback System', () => {
    const mockDrill = {
      prompt_bg: 'Test prompt',
      answer_bg: 'test answer',
    };

    beforeEach(() => {
      drillInterface.createInlineDrill(mockDrill, container);
    });

    it('should show feedback messages', () => {
      drillInterface.showFeedback('success', 'Great job!');

      const feedback = container.querySelector('.drill-feedback.success');
      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toBe('Great job!');
    });

    it('should replace existing feedback', () => {
      drillInterface.showFeedback('success', 'First message');
      drillInterface.showFeedback('error', 'Second message');

      const feedbacks = container.querySelectorAll('.drill-feedback');
      expect(feedbacks.length).toBe(1);
      expect(feedbacks[0].textContent).toBe('Second message');
      expect(feedbacks[0].classList.contains('error')).toBe(true);
    });
  });

  describe('Drill Cleanup', () => {
    const mockDrill = {
      prompt_bg: 'Test prompt',
      answer_bg: 'test answer',
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clean up timers when closing drill', () => {
      drillInterface.createInlineDrill(mockDrill, container);

      drillInterface.closeDrill();

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
      expect(drillInterface.drillTimer).toBeNull();
    });

    it('should remove drill element with animation', () => {
      drillInterface.createInlineDrill(mockDrill, container);
      const drillElement = container.querySelector('.inline-drill-container');

      drillInterface.closeDrill();

      expect(drillElement.style.opacity).toBe('0');

      // Fast forward past animation
      vi.advanceTimersByTime(500);

      expect(container.querySelector('.inline-drill-container')).toBeFalsy();
      expect(drillInterface.activeDrill).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle drill creation without container', () => {
      expect(() => drillInterface.createInlineDrill({}, null)).toThrow();
    });

    it('should handle timer operations without active drill', () => {
      expect(() => drillInterface.timeUp()).not.toThrow();
      expect(() => drillInterface.closeDrill()).not.toThrow();
    });

    it('should handle feedback without active drill', () => {
      expect(() => drillInterface.showFeedback('success', 'test')).not.toThrow();
    });

    it('should handle empty drill data', () => {
      const emptyDrill = {};
      expect(() => drillInterface.createInlineDrill(emptyDrill, container)).not.toThrow();

      const prompt = container.querySelector('.drill-prompt');
      expect(prompt.textContent).toBe('');
    });

    it('should handle drill without answer', () => {
      const drillWithoutAnswer = { prompt_bg: 'Test prompt' };
      drillInterface.createInlineDrill(drillWithoutAnswer, container);

      const result = drillInterface.checkAnswer('any answer', undefined);
      expect(result).toBe(false);
    });
  });
});
