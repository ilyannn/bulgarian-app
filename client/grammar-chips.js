/**
 * Grammar Chips UI Component
 * Interactive grammar error chips with tap-to-expand functionality
 * Displays grammar corrections with detailed explanations and practice options
 */

export class GrammarChipsUI {
  constructor() {
    this.chips = new Map();
    this.expandedChip = null;
    this.onPracticeCallback = null;

    this.initializeStyles();
  }

  /**
   * Initialize CSS styles for grammar chips
   */
  initializeStyles() {
    if (document.getElementById('grammar-chips-styles')) return;

    const style = document.createElement('style');
    style.id = 'grammar-chips-styles';
    style.textContent = `
      .grammar-chips-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
        animation: fadeIn 0.3s ease-in;
      }

      .grammar-chip {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        user-select: none;
        position: relative;
        max-width: 100%;
      }

      .grammar-chip.error-minor {
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        color: #92400e;
        border: 1px solid #f59e0b;
      }

      .grammar-chip.error-moderate {
        background: linear-gradient(135deg, #fed7aa, #fdba74);
        color: #7c2d12;
        border: 1px solid #f97316;
      }

      .grammar-chip.error-serious {
        background: linear-gradient(135deg, #fecaca, #fca5a5);
        color: #7f1d1d;
        border: 1px solid #ef4444;
      }

      .grammar-chip:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .grammar-chip.expanded {
        flex-direction: column;
        align-items: flex-start;
        padding: 12px 16px;
        min-width: 280px;
        animation: expand 0.3s ease;
      }

      .chip-header {
        display: flex;
        align-items: center;
        width: 100%;
        justify-content: space-between;
      }

      .chip-icon {
        margin-right: 6px;
        font-size: 16px;
      }

      .chip-expand-icon {
        margin-left: 8px;
        transition: transform 0.3s ease;
        opacity: 0.7;
      }

      .chip-expanded .chip-expand-icon {
        transform: rotate(180deg);
      }

      .chip-details {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        width: 100%;
        animation: slideDown 0.3s ease;
      }

      .chip-before-after {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 10px;
      }

      .chip-text-line {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }

      .chip-label {
        font-weight: 600;
        min-width: 45px;
      }

      .chip-wrong {
        text-decoration: line-through;
        color: #dc2626;
        background: rgba(220, 38, 38, 0.1);
        padding: 2px 4px;
        border-radius: 3px;
      }

      .chip-correct {
        color: #059669;
        background: rgba(5, 150, 105, 0.1);
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 500;
      }

      .chip-explanation {
        font-size: 13px;
        line-height: 1.5;
        color: rgba(0, 0, 0, 0.8);
        margin: 8px 0;
      }

      .chip-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }

      .chip-action-btn {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        background: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .chip-action-btn:hover {
        background: white;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      }

      .chip-action-btn.primary {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
      }

      .chip-action-btn.primary:hover {
        background: #2563eb;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes expand {
        from { min-width: auto; }
        to { min-width: 280px; }
      }

      @keyframes slideDown {
        from { opacity: 0; max-height: 0; }
        to { opacity: 1; max-height: 200px; }
      }

      @media (prefers-color-scheme: dark) {
        .grammar-chip {
          filter: brightness(0.9);
        }
        
        .chip-explanation {
          color: rgba(0, 0, 0, 0.9);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create grammar chips from corrections
   * @param {Array} corrections - Array of correction objects
   * @param {HTMLElement} container - Container element for chips
   */
  createChips(corrections, container) {
    if (!corrections || corrections.length === 0) return;

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'grammar-chips-container';

    let index = 0;
    for (const correction of corrections) {
      const chipId = `chip-${Date.now()}-${index}`;
      const chip = this.createChip(correction, chipId);
      this.chips.set(chipId, { element: chip, data: correction });
      chipsContainer.appendChild(chip);
      index++;
    }

    container.appendChild(chipsContainer);
  }

  /**
   * Create individual grammar chip
   * @param {Object} correction - Correction data
   * @param {string} chipId - Unique chip identifier
   * @returns {HTMLElement} Chip element
   */
  createChip(correction, chipId) {
    const chip = document.createElement('div');
    chip.className = `grammar-chip ${this.getSeverityClass(correction.type)}`;
    chip.dataset.chipId = chipId;

    // Create chip header
    const header = document.createElement('div');
    header.className = 'chip-header';

    const mainContent = document.createElement('div');
    mainContent.style.display = 'flex';
    mainContent.style.alignItems = 'center';

    const icon = document.createElement('span');
    icon.className = 'chip-icon';
    icon.textContent = this.getSeverityIcon(correction.type);

    const label = document.createElement('span');
    label.textContent = this.getChipLabel(correction);

    const expandIcon = document.createElement('span');
    expandIcon.className = 'chip-expand-icon';
    expandIcon.textContent = '▼';

    mainContent.appendChild(icon);
    mainContent.appendChild(label);
    header.appendChild(mainContent);
    header.appendChild(expandIcon);

    chip.appendChild(header);

    // Add click handler
    chip.addEventListener('click', (e) => this.handleChipClick(e, chipId));

    return chip;
  }

  /**
   * Handle chip click for expand/collapse
   * @param {Event} e - Click event
   * @param {string} chipId - Chip identifier
   */
  handleChipClick(e, chipId) {
    e.stopPropagation();

    const chipData = this.chips.get(chipId);
    if (!chipData) return;

    const { element, data } = chipData;

    // If this chip is already expanded, collapse it
    if (this.expandedChip === chipId) {
      this.collapseChip(element);
      this.expandedChip = null;
      return;
    }

    // Collapse any previously expanded chip
    if (this.expandedChip) {
      const prevChipData = this.chips.get(this.expandedChip);
      if (prevChipData) {
        this.collapseChip(prevChipData.element);
      }
    }

    // Expand this chip
    this.expandChip(element, data);
    this.expandedChip = chipId;
  }

  /**
   * Expand a chip to show details
   * @param {HTMLElement} chip - Chip element
   * @param {Object} data - Correction data
   */
  expandChip(chip, data) {
    chip.classList.add('expanded');

    // Remove existing details if any
    const existingDetails = chip.querySelector('.chip-details');
    if (existingDetails) {
      existingDetails.remove();
    }

    // Create details section
    const details = document.createElement('div');
    details.className = 'chip-details';

    // Before/After section
    if (data.before && data.after) {
      const beforeAfter = document.createElement('div');
      beforeAfter.className = 'chip-before-after';

      const beforeLine = document.createElement('div');
      beforeLine.className = 'chip-text-line';

      const beforeLabel = document.createElement('span');
      beforeLabel.className = 'chip-label';
      beforeLabel.textContent = 'Before:';

      const beforeText = document.createElement('span');
      beforeText.className = 'chip-wrong';
      beforeText.textContent = data.before;

      beforeLine.appendChild(beforeLabel);
      beforeLine.appendChild(beforeText);

      const afterLine = document.createElement('div');
      afterLine.className = 'chip-text-line';

      const afterLabel = document.createElement('span');
      afterLabel.className = 'chip-label';
      afterLabel.textContent = 'After:';

      const afterText = document.createElement('span');
      afterText.className = 'chip-correct';
      afterText.textContent = data.after;

      afterLine.appendChild(afterLabel);
      afterLine.appendChild(afterText);

      beforeAfter.appendChild(beforeLine);
      beforeAfter.appendChild(afterLine);
      details.appendChild(beforeAfter);
    }

    // Explanation
    if (data.note || data.explanation) {
      const explanation = document.createElement('div');
      explanation.className = 'chip-explanation';
      explanation.textContent = data.note || data.explanation;
      details.appendChild(explanation);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'chip-actions';

    const practiceBtn = document.createElement('button');
    practiceBtn.className = 'chip-action-btn primary';
    practiceBtn.textContent = '📝 Practice';
    practiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlePractice(data);
    });

    const learnBtn = document.createElement('button');
    learnBtn.className = 'chip-action-btn';
    learnBtn.textContent = '📚 Learn More';
    learnBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleLearnMore(data);
    });

    actions.appendChild(practiceBtn);
    actions.appendChild(learnBtn);
    details.appendChild(actions);

    chip.appendChild(details);
  }

  /**
   * Collapse an expanded chip
   * @param {HTMLElement} chip - Chip element
   */
  collapseChip(chip) {
    chip.classList.remove('expanded');
    const details = chip.querySelector('.chip-details');
    if (details) {
      details.remove();
    }
  }

  /**
   * Get severity class based on error type
   * @param {string} type - Error type
   * @returns {string} CSS class
   */
  getSeverityClass(type) {
    const severityMap = {
      spelling: 'error-minor',
      grammar_minor: 'error-minor',
      clitic_position: 'error-moderate',
      infinitive_usage: 'error-moderate',
      definite_article: 'error-serious',
      future_tense: 'error-serious',
      agreement: 'error-serious',
    };
    return severityMap[type] || 'error-moderate';
  }

  /**
   * Get severity icon
   * @param {string} type - Error type
   * @returns {string} Icon
   */
  getSeverityIcon(type) {
    const severity = this.getSeverityClass(type);
    if (severity.includes('minor')) return '💡';
    if (severity.includes('serious')) return '⚠️';
    return '📝';
  }

  /**
   * Get chip label text
   * @param {Object} correction - Correction data
   * @returns {string} Label text
   */
  getChipLabel(correction) {
    if (correction.error_tag) {
      // Extract readable label from error tag
      return correction.error_tag
        .split('.')
        .pop()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return correction.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Handle practice button click
   * @param {Object} data - Correction data
   */
  handlePractice(data) {
    if (this.onPracticeCallback) {
      this.onPracticeCallback(data);
    }

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent('grammar-practice-requested', {
        detail: { correction: data },
      })
    );
  }

  /**
   * Handle learn more button click
   * @param {Object} data - Correction data
   */
  handleLearnMore(data) {
    // Dispatch custom event for learn more
    window.dispatchEvent(
      new CustomEvent('grammar-learn-more', {
        detail: { correction: data },
      })
    );
  }

  /**
   * Set practice callback
   * @param {Function} callback - Callback function
   */
  setPracticeCallback(callback) {
    this.onPracticeCallback = callback;
  }

  /**
   * Clear all chips
   */
  clear() {
    this.chips.clear();
    this.expandedChip = null;
  }
}

// Auto-initialize if loaded in browser
if (typeof window !== 'undefined' && !globalThis.process?.env?.NODE_ENV?.includes('test')) {
  window.grammarChipsUI = new GrammarChipsUI();
}
