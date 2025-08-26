/**
 * Inline Drill Interface
 * Quick practice component for 10-20 second drill interactions
 * Displays drills directly in the transcript for immediate practice
 */

export class InlineDrillInterface {
  constructor() {
    this.activeDrill = null;
    this.drillTimer = null;
    this.startTime = null;
    this.onCompleteCallback = null;
    this.drillResults = new Map();

    this.initializeStyles();
    this.setupEventListeners();
  }

  /**
   * Initialize CSS styles for inline drills
   */
  initializeStyles() {
    if (document.getElementById('inline-drills-styles')) return;

    const style = document.createElement('style');
    style.id = 'inline-drills-styles';
    style.textContent = `
      .inline-drill-container {
        margin: 16px 0;
        padding: 16px;
        border-radius: 12px;
        background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
        border: 2px solid #0ea5e9;
        animation: slideIn 0.3s ease;
        position: relative;
      }

      .inline-drill-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .drill-title {
        font-weight: 600;
        color: #0369a1;
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .drill-timer {
        font-size: 14px;
        color: #64748b;
        font-weight: 500;
        padding: 4px 8px;
        background: white;
        border-radius: 20px;
      }

      .drill-timer.warning {
        color: #f59e0b;
        background: #fef3c7;
      }

      .drill-timer.critical {
        color: #ef4444;
        background: #fee2e2;
      }

      .drill-prompt {
        font-size: 18px;
        color: #1e293b;
        margin-bottom: 16px;
        font-weight: 500;
        line-height: 1.5;
      }

      .drill-prompt .highlight {
        background: #fef08a;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 600;
      }

      .drill-input-area {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .drill-input {
        flex: 1;
        padding: 10px 14px;
        border: 2px solid #cbd5e1;
        border-radius: 8px;
        font-size: 16px;
        font-family: inherit;
        transition: all 0.2s ease;
      }

      .drill-input:focus {
        outline: none;
        border-color: #0ea5e9;
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
      }

      .drill-input.correct {
        border-color: #10b981;
        background: #f0fdf4;
      }

      .drill-input.incorrect {
        border-color: #ef4444;
        background: #fef2f2;
      }

      .drill-submit-btn {
        padding: 10px 20px;
        background: #0ea5e9;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .drill-submit-btn:hover {
        background: #0284c7;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
      }

      .drill-submit-btn:disabled {
        background: #94a3b8;
        cursor: not-allowed;
        transform: none;
      }

      .drill-feedback {
        padding: 12px;
        border-radius: 8px;
        margin-top: 12px;
        font-size: 14px;
        animation: fadeIn 0.3s ease;
      }

      .drill-feedback.success {
        background: #dcfce7;
        color: #14532d;
        border: 1px solid #86efac;
      }

      .drill-feedback.error {
        background: #fee2e2;
        color: #7f1d1d;
        border: 1px solid #fca5a5;
      }

      .drill-feedback.hint {
        background: #fef3c7;
        color: #78350f;
        border: 1px solid #fde68a;
      }

      .drill-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        justify-content: flex-end;
      }

      .drill-action-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #e2e8f0;
        background: white;
      }

      .drill-action-btn:hover {
        background: #f8fafc;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .drill-action-btn.skip {
        color: #64748b;
      }

      .drill-action-btn.hint {
        color: #f59e0b;
        border-color: #fbbf24;
      }

      .drill-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(14, 165, 233, 0.2);
        border-radius: 0 0 10px 10px;
        overflow: hidden;
      }

      .drill-progress-bar {
        height: 100%;
        background: #0ea5e9;
        transition: width 0.1s linear;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @media (max-width: 640px) {
        .drill-input-area {
          flex-direction: column;
        }

        .drill-submit-btn {
          width: 100%;
          justify-content: center;
        }
      }

      @media (prefers-color-scheme: dark) {
        .inline-drill-container {
          background: linear-gradient(135deg, #1e3a5f, #1e4066);
          border-color: #0284c7;
        }

        .drill-input {
          background: #1e293b;
          color: #f1f5f9;
          border-color: #475569;
        }

        .drill-prompt {
          color: #f1f5f9;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Listen for drill practice requests from grammar chips
    window.addEventListener('grammar-practice-requested', (e) => {
      if (e.detail?.correction) {
        this.startDrillFromCorrection(e.detail.correction);
      }
    });
  }

  /**
   * Create and display inline drill
   * @param {Object} drill - Drill data
   * @param {HTMLElement} container - Container element
   */
  createInlineDrill(drill, container) {
    if (this.activeDrill) {
      this.closeDrill();
    }

    const drillElement = document.createElement('div');
    drillElement.className = 'inline-drill-container';
    drillElement.id = `drill-${Date.now()}`;

    // Header with timer
    const header = document.createElement('div');
    header.className = 'inline-drill-header';

    const title = document.createElement('div');
    title.className = 'drill-title';
    title.innerHTML = `📝 Quick Practice ${drill.type ? `(${drill.type})` : ''}`;

    const timer = document.createElement('div');
    timer.className = 'drill-timer';
    timer.textContent = '20s';

    header.appendChild(title);
    header.appendChild(timer);

    // Drill prompt
    const prompt = document.createElement('div');
    prompt.className = 'drill-prompt';
    prompt.innerHTML = this.formatPrompt(drill.prompt_bg || drill.prompt);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'drill-input-area';

    const input = document.createElement('input');
    input.className = 'drill-input';
    input.type = 'text';
    input.placeholder = 'Type your answer...';
    input.id = `drill-input-${Date.now()}`;

    // Handle enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submitAnswer(drill, input.value);
      }
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'drill-submit-btn';
    submitBtn.innerHTML = '✓ Check';
    submitBtn.addEventListener('click', () => {
      this.submitAnswer(drill, input.value);
    });

    inputArea.appendChild(input);
    inputArea.appendChild(submitBtn);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'drill-actions';

    const hintBtn = document.createElement('button');
    hintBtn.className = 'drill-action-btn hint';
    hintBtn.textContent = '💡 Hint';
    hintBtn.addEventListener('click', () => this.showHint(drill, drillElement));

    const skipBtn = document.createElement('button');
    skipBtn.className = 'drill-action-btn skip';
    skipBtn.textContent = '⏭️ Skip';
    skipBtn.addEventListener('click', () => this.skipDrill(drill));

    actions.appendChild(hintBtn);
    actions.appendChild(skipBtn);

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'drill-progress';
    const progressBar = document.createElement('div');
    progressBar.className = 'drill-progress-bar';
    progressBar.style.width = '100%';
    progress.appendChild(progressBar);

    // Assemble drill element
    drillElement.appendChild(header);
    drillElement.appendChild(prompt);
    drillElement.appendChild(inputArea);
    drillElement.appendChild(actions);
    drillElement.appendChild(progress);

    // Add to container
    container.appendChild(drillElement);

    // Start drill
    this.activeDrill = {
      element: drillElement,
      data: drill,
      input: input,
      timer: timer,
      progressBar: progressBar,
      submitBtn: submitBtn,
    };

    this.startTimer();
    input.focus();

    // Auto-scroll to drill (if available)
    if (typeof drillElement.scrollIntoView === 'function') {
      drillElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Format prompt with highlighting
   * @param {string} prompt - Prompt text
   * @returns {string} Formatted HTML
   */
  formatPrompt(prompt) {
    if (!prompt) return '';
    // Highlight blanks or special markers
    return prompt
      .replace(/_+/g, '<span class="highlight">___</span>')
      .replace(/\[([^\]]+)\]/g, '<span class="highlight">$1</span>');
  }

  /**
   * Start countdown timer
   */
  startTimer() {
    this.startTime = Date.now();
    const duration = 20000; // 20 seconds

    const updateTimer = () => {
      if (!this.activeDrill) return;

      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, duration - elapsed);
      const seconds = Math.ceil(remaining / 1000);

      this.activeDrill.timer.textContent = `${seconds}s`;

      // Update timer color
      if (seconds <= 5) {
        this.activeDrill.timer.className = 'drill-timer critical';
      } else if (seconds <= 10) {
        this.activeDrill.timer.className = 'drill-timer warning';
      }

      // Update progress bar
      const progress = ((duration - remaining) / duration) * 100;
      this.activeDrill.progressBar.style.width = `${100 - progress}%`;

      if (remaining > 0) {
        this.drillTimer =
          typeof requestAnimationFrame !== 'undefined'
            ? requestAnimationFrame(updateTimer)
            : setTimeout(updateTimer, 16);
      } else {
        this.timeUp();
      }
    };

    updateTimer();
  }

  /**
   * Handle time up
   */
  timeUp() {
    if (!this.activeDrill) return;

    this.activeDrill.input.disabled = true;
    this.activeDrill.submitBtn.disabled = true;

    this.showFeedback(
      'hint',
      `⏰ Time's up! The answer was: ${this.activeDrill.data.answer_bg || this.activeDrill.data.answer}`
    );

    this.recordResult(this.activeDrill.data, false, 20);

    setTimeout(() => this.closeDrill(), 3000);
  }

  /**
   * Submit answer
   * @param {Object} drill - Drill data
   * @param {string} answer - User's answer
   */
  submitAnswer(drill, answer) {
    if (!answer.trim()) return;

    const elapsed = (Date.now() - this.startTime) / 1000;
    const correct = this.checkAnswer(answer, drill.answer_bg || drill.answer);

    if (correct) {
      this.activeDrill.input.classList.add('correct');
      this.showFeedback('success', "✅ Excellent! That's correct!");
      this.recordResult(drill, true, elapsed);

      // Close after success
      setTimeout(() => this.closeDrill(), 2000);
    } else {
      this.activeDrill.input.classList.add('incorrect');
      this.showFeedback(
        'error',
        `❌ Not quite. The correct answer is: ${drill.answer_bg || drill.answer}`
      );
      this.recordResult(drill, false, elapsed);

      // Allow retry
      setTimeout(() => {
        this.activeDrill.input.classList.remove('incorrect');
        this.activeDrill.input.value = '';
        this.activeDrill.input.focus();
      }, 2000);
    }
  }

  /**
   * Check if answer is correct
   * @param {string} userAnswer - User's answer
   * @param {string} correctAnswer - Correct answer
   * @returns {boolean} Whether answer is correct
   */
  checkAnswer(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    // Normalize both answers
    const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    return normalize(userAnswer) === normalize(correctAnswer);
  }

  /**
   * Show hint
   * @param {Object} drill - Drill data
   * @param {HTMLElement} container - Drill container
   */
  showHint(drill, _container) {
    const answer = drill.answer_bg || drill.answer || 'unknown';
    const hint = `${answer.substring(0, Math.ceil(answer.length / 2))}...`;
    this.showFeedback('hint', `💡 Hint: ${hint}`);
  }

  /**
   * Skip current drill
   * @param {Object} drill - Drill data
   */
  skipDrill(drill) {
    this.recordResult(drill, false, 0);
    this.closeDrill();
  }

  /**
   * Show feedback message
   * @param {string} type - Feedback type (success, error, hint)
   * @param {string} message - Feedback message
   */
  showFeedback(type, message) {
    if (!this.activeDrill) return;

    // Remove existing feedback
    const existing = this.activeDrill.element.querySelector('.drill-feedback');
    if (existing) {
      existing.remove();
    }

    const feedback = document.createElement('div');
    feedback.className = `drill-feedback ${type}`;
    feedback.textContent = message;

    // Insert before actions
    const actions = this.activeDrill.element.querySelector('.drill-actions');
    this.activeDrill.element.insertBefore(feedback, actions);
  }

  /**
   * Close active drill
   */
  closeDrill() {
    if (!this.activeDrill) return;

    if (this.drillTimer) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.drillTimer);
      } else {
        clearTimeout(this.drillTimer);
      }
      this.drillTimer = null;
    }

    // Fade out animation
    this.activeDrill.element.style.opacity = '0';
    this.activeDrill.element.style.transform = 'translateY(-10px)';

    setTimeout(() => {
      if (this.activeDrill?.element?.parentNode) {
        this.activeDrill.element.remove();
      }
      this.activeDrill = null;
    }, 300);

    // Trigger complete callback
    if (this.onCompleteCallback) {
      this.onCompleteCallback(Array.from(this.drillResults.values()));
    }
  }

  /**
   * Record drill result
   * @param {Object} drill - Drill data
   * @param {boolean} correct - Whether answer was correct
   * @param {number} timeSpent - Time spent in seconds
   */
  recordResult(drill, correct, timeSpent) {
    const result = {
      drill: drill,
      correct: correct,
      timeSpent: timeSpent,
      timestamp: Date.now(),
    };

    this.drillResults.set(drill.id || Date.now(), result);

    // Dispatch event for tracking
    window.dispatchEvent(
      new CustomEvent('drill-completed', {
        detail: result,
      })
    );
  }

  /**
   * Start drill from grammar correction
   * @param {Object} correction - Grammar correction data
   */
  startDrillFromCorrection(correction) {
    // Create drill from correction
    const drill = {
      type: 'transform',
      prompt_bg: `Change: "${correction.before}" to correct form`,
      answer_bg: correction.after,
      note: correction.note,
      error_tag: correction.error_tag,
    };

    // Find suitable container
    const container = document.querySelector('.transcript-area') || document.body;
    this.createInlineDrill(drill, container);
  }

  /**
   * Set completion callback
   * @param {Function} callback - Callback function
   */
  setCompleteCallback(callback) {
    this.onCompleteCallback = callback;
  }

  /**
   * Get drill results
   * @returns {Array} Array of drill results
   */
  getResults() {
    return Array.from(this.drillResults.values());
  }

  /**
   * Clear results
   */
  clearResults() {
    this.drillResults.clear();
  }
}

// Auto-initialize if loaded in browser
if (typeof window !== 'undefined' && !globalThis.process?.env?.NODE_ENV?.includes('test')) {
  window.inlineDrillInterface = new InlineDrillInterface();
}
