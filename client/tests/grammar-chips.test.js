/**
 * Grammar Chips UI Tests
 * Test suite for interactive grammar chip functionality
 */

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrammarChipsUI } from '../grammar-chips.js';

describe('GrammarChipsUI', () => {
  let dom;
  let document;
  let window;
  let grammarChips;
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

    container = document.getElementById('container');
    grammarChips = new GrammarChipsUI();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.document = undefined;
    global.window = undefined;
    global.CustomEvent = undefined;
  });

  describe('Initialization', () => {
    it('should initialize with empty chips map', () => {
      expect(grammarChips.chips).toBeInstanceOf(Map);
      expect(grammarChips.chips.size).toBe(0);
    });

    it('should have no expanded chip initially', () => {
      expect(grammarChips.expandedChip).toBeNull();
    });

    it('should inject styles into document head', () => {
      const styles = document.getElementById('grammar-chips-styles');
      expect(styles).toBeTruthy();
      expect(styles.textContent).toContain('.grammar-chips-container');
    });

    it('should not duplicate styles on multiple initializations', () => {
      new GrammarChipsUI();
      const styles = document.querySelectorAll('#grammar-chips-styles');
      expect(styles.length).toBe(1);
    });
  });

  describe('Chip Creation', () => {
    const mockCorrections = [
      {
        type: 'infinitive_usage',
        before: 'искам поръчвам',
        after: 'искам да поръчам',
        note: 'Use да + present tense',
        error_tag: 'bg.no_infinitive.da_present',
      },
      {
        type: 'definite_article',
        before: 'кафе',
        after: 'кафето',
        note: 'Add definite article',
        error_tag: 'bg.definite.article.postposed',
      },
    ];

    it('should create chips from corrections', () => {
      grammarChips.createChips(mockCorrections, container);

      const chipsContainer = container.querySelector('.grammar-chips-container');
      expect(chipsContainer).toBeTruthy();

      const chips = chipsContainer.querySelectorAll('.grammar-chip');
      expect(chips.length).toBe(2);
    });

    it('should not create chips for empty corrections', () => {
      grammarChips.createChips([], container);
      const chipsContainer = container.querySelector('.grammar-chips-container');
      expect(chipsContainer).toBeFalsy();
    });

    it('should apply correct severity classes', () => {
      grammarChips.createChips(mockCorrections, container);

      const chips = container.querySelectorAll('.grammar-chip');
      expect(chips[0].classList.contains('error-moderate')).toBe(true);
      expect(chips[1].classList.contains('error-serious')).toBe(true);
    });

    it('should display proper chip labels', () => {
      grammarChips.createChips(mockCorrections, container);

      const chips = container.querySelectorAll('.grammar-chip');
      expect(chips[0].textContent).toContain('Da Present');
      expect(chips[1].textContent).toContain('Postposed');
    });

    it('should store chip data in map', () => {
      grammarChips.createChips(mockCorrections, container);
      expect(grammarChips.chips.size).toBe(2);

      const chipData = Array.from(grammarChips.chips.values());
      expect(chipData[0].data).toEqual(mockCorrections[0]);
      expect(chipData[1].data).toEqual(mockCorrections[1]);
    });
  });

  describe('Chip Interaction', () => {
    const mockCorrection = {
      type: 'infinitive_usage',
      before: 'искам поръчвам',
      after: 'искам да поръчам',
      note: 'Use да + present tense',
      error_tag: 'bg.no_infinitive.da_present',
    };

    beforeEach(() => {
      grammarChips.createChips([mockCorrection], container);
    });

    it('should expand chip on click', () => {
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      expect(chip.classList.contains('expanded')).toBe(true);
      expect(chip.querySelector('.chip-details')).toBeTruthy();
    });

    it('should show before/after text when expanded', () => {
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const details = chip.querySelector('.chip-details');
      expect(details.textContent).toContain('искам поръчвам');
      expect(details.textContent).toContain('искам да поръчам');
    });

    it('should show explanation when expanded', () => {
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const explanation = chip.querySelector('.chip-explanation');
      expect(explanation).toBeTruthy();
      expect(explanation.textContent).toBe('Use да + present tense');
    });

    it('should collapse chip on second click', () => {
      const chip = container.querySelector('.grammar-chip');
      chip.click(); // expand
      chip.click(); // collapse

      expect(chip.classList.contains('expanded')).toBe(false);
      expect(chip.querySelector('.chip-details')).toBeFalsy();
    });

    it('should collapse previous chip when expanding another', () => {
      const corrections = [mockCorrection, { ...mockCorrection, type: 'clitic_position' }];
      container.innerHTML = '';
      grammarChips.createChips(corrections, container);

      const chips = container.querySelectorAll('.grammar-chip');
      chips[0].click(); // expand first
      chips[1].click(); // expand second

      expect(chips[0].classList.contains('expanded')).toBe(false);
      expect(chips[1].classList.contains('expanded')).toBe(true);
    });
  });

  describe('Action Buttons', () => {
    const mockCorrection = {
      type: 'infinitive_usage',
      before: 'искам поръчвам',
      after: 'искам да поръчам',
      note: 'Use да + present tense',
      error_tag: 'bg.no_infinitive.da_present',
    };

    beforeEach(() => {
      grammarChips.createChips([mockCorrection], container);
    });

    it('should show practice and learn more buttons when expanded', () => {
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const practiceBtn = chip.querySelector('.chip-action-btn.primary');
      const learnBtn = chip.querySelector('.chip-action-btn:not(.primary)');

      expect(practiceBtn).toBeTruthy();
      expect(practiceBtn.textContent).toContain('Practice');
      expect(learnBtn).toBeTruthy();
      expect(learnBtn.textContent).toContain('Learn More');
    });

    it('should dispatch practice event on practice button click', () => {
      const eventSpy = vi.fn();
      window.addEventListener('grammar-practice-requested', eventSpy);

      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const practiceBtn = chip.querySelector('.chip-action-btn.primary');
      practiceBtn.click();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0].detail.correction).toEqual(mockCorrection);
    });

    it('should call practice callback if set', () => {
      const callback = vi.fn();
      grammarChips.setPracticeCallback(callback);

      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const practiceBtn = chip.querySelector('.chip-action-btn.primary');
      practiceBtn.click();

      expect(callback).toHaveBeenCalledWith(mockCorrection);
    });

    it('should dispatch learn more event', () => {
      const eventSpy = vi.fn();
      window.addEventListener('grammar-learn-more', eventSpy);

      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const learnBtn = chip.querySelector('.chip-action-btn:not(.primary)');
      learnBtn.click();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0].detail.correction).toEqual(mockCorrection);
    });

    it('should stop event propagation on button clicks', () => {
      const chipClickSpy = vi.fn();
      const chip = container.querySelector('.grammar-chip');
      chip.addEventListener('click', chipClickSpy);

      chip.click(); // expand
      chipClickSpy.mockClear();

      const practiceBtn = chip.querySelector('.chip-action-btn.primary');
      practiceBtn.click();

      // Should not trigger chip click
      expect(chipClickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Severity Classification', () => {
    it('should classify spelling as minor', () => {
      const className = grammarChips.getSeverityClass('spelling');
      expect(className).toBe('error-minor');
    });

    it('should classify infinitive_usage as moderate', () => {
      const className = grammarChips.getSeverityClass('infinitive_usage');
      expect(className).toBe('error-moderate');
    });

    it('should classify definite_article as serious', () => {
      const className = grammarChips.getSeverityClass('definite_article');
      expect(className).toBe('error-serious');
    });

    it('should default unknown types to moderate', () => {
      const className = grammarChips.getSeverityClass('unknown_error');
      expect(className).toBe('error-moderate');
    });
  });

  describe('Icon Selection', () => {
    it('should use lightbulb for minor errors', () => {
      const icon = grammarChips.getSeverityIcon('spelling');
      expect(icon).toBe('💡');
    });

    it('should use warning for serious errors', () => {
      const icon = grammarChips.getSeverityIcon('definite_article');
      expect(icon).toBe('⚠️');
    });

    it('should use pencil for moderate errors', () => {
      const icon = grammarChips.getSeverityIcon('clitic_position');
      expect(icon).toBe('📝');
    });
  });

  describe('Label Generation', () => {
    it('should format error tag as label', () => {
      const label = grammarChips.getChipLabel({
        error_tag: 'bg.no_infinitive.da_present',
      });
      expect(label).toBe('Da Present');
    });

    it('should format type as label when no error tag', () => {
      const label = grammarChips.getChipLabel({
        type: 'clitic_position',
      });
      expect(label).toBe('Clitic Position');
    });
  });

  describe('Clear Functionality', () => {
    it('should clear all chips', () => {
      const corrections = [
        { type: 'spelling', before: 'a', after: 'b' },
        { type: 'grammar_minor', before: 'c', after: 'd' },
      ];

      grammarChips.createChips(corrections, container);
      expect(grammarChips.chips.size).toBe(2);

      grammarChips.clear();
      expect(grammarChips.chips.size).toBe(0);
      expect(grammarChips.expandedChip).toBeNull();
    });
  });

  describe('XSS Protection', () => {
    it('should safely handle HTML in text content', () => {
      const maliciousCorrection = {
        type: 'test',
        before: '<script>alert("XSS")</script>',
        after: '<img src=x onerror="alert(1)">',
        note: '<div onclick="alert(2)">Click me</div>',
      };

      grammarChips.createChips([maliciousCorrection], container);
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const details = chip.querySelector('.chip-details');
      // Check that the actual script tag is not executed (it's escaped)
      expect(details.innerHTML).toContain('&lt;script&gt;');
      expect(details.innerHTML).toContain('&lt;img');
      // The text content should show the literal strings
      expect(details.textContent).toContain('<script>alert("XSS")</script>');
      expect(details.textContent).toContain('<img src=x onerror="alert(1)">');
      expect(details.textContent).toContain('<div onclick="alert(2)">Click me</div>');
    });
  });

  describe('Edge Cases', () => {
    it('should handle corrections without before/after', () => {
      const correction = {
        type: 'grammar_minor',
        note: 'General grammar issue',
      };

      grammarChips.createChips([correction], container);
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const beforeAfter = chip.querySelector('.chip-before-after');
      expect(beforeAfter).toBeFalsy();

      const explanation = chip.querySelector('.chip-explanation');
      expect(explanation).toBeTruthy();
      expect(explanation.textContent).toBe('General grammar issue');
    });

    it('should handle corrections without note or explanation', () => {
      const correction = {
        type: 'grammar_minor',
        before: 'wrong',
        after: 'right',
      };

      grammarChips.createChips([correction], container);
      const chip = container.querySelector('.grammar-chip');
      chip.click();

      const explanation = chip.querySelector('.chip-explanation');
      expect(explanation).toBeFalsy();
    });

    it('should handle null corrections array', () => {
      expect(() => grammarChips.createChips(null, container)).not.toThrow();
      const chipsContainer = container.querySelector('.grammar-chips-container');
      expect(chipsContainer).toBeFalsy();
    });

    it('should handle undefined container', () => {
      expect(() => grammarChips.createChips([{ type: 'test' }], undefined)).toThrow();
    });
  });
});
