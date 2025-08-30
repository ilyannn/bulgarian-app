/**
 * Mini-Lesson Modal Component for Bulgarian Voice Coach
 *
 * Interactive modal for displaying and completing mini-lessons.
 * Features:
 * - Rich Bulgarian typography with Ysabeau font
 * - L1-specific contrast notes
 * - Interactive quick drills
 * - Progress tracking
 * - Memory tips and examples
 */

class MiniLessonModal {
  constructor(containerSelector = 'body') {
    this.container = document.querySelector(containerSelector);
    this.isVisible = false;
    this.currentLesson = null;
    this.startTime = null;
    this.drillResults = [];
    this.onComplete = null;
    this.userL1 = this.getUserL1Language();

    this.createModal();
    this.bindEvents();
  }

  /**
   * Create the modal structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'mini-lesson-modal';
    this.modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content bg-text">
        <div class="modal-header">
          <h2 class="lesson-title bg-text"></h2>
          <button class="modal-close" aria-label="Close lesson">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="lesson-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <span class="progress-text">0 / 0</span>
          </div>

          <div class="lesson-content">
            <!-- Dynamic content will be inserted here -->
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary lesson-skip">Прескочи</button>
          <button class="btn btn-primary lesson-continue" disabled>Продължи</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.modal);
    this.addStyles();
  }

  /**
   * Add CSS styles for the modal
   */
  addStyles() {
    if (document.getElementById('mini-lesson-modal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'mini-lesson-modal-styles';
    styles.textContent = `
      .mini-lesson-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .mini-lesson-modal.visible {
        display: flex;
      }

      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(3px);
      }

      .modal-content {
        position: relative;
        background: var(--bg-primary, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: modalEnter 0.3s ease-out;
      }

      @keyframes modalEnter {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .lesson-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0;
        color: var(--text-primary, #111827);
      }

      .modal-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 6px;
        color: var(--text-secondary, #6b7280);
        transition: all 0.2s ease;
      }

      .modal-close:hover {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-primary, #111827);
      }

      .modal-body {
        flex: 1;
        padding: 1rem 1.5rem;
        overflow-y: auto;
      }

      .lesson-progress {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .progress-bar {
        flex: 1;
        height: 6px;
        background: var(--bg-secondary, #f3f4f6);
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--accent-primary, #3b82f6);
        border-radius: 3px;
        transition: width 0.3s ease;
        width: 0%;
      }

      .progress-text {
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        font-weight: 500;
      }

      .lesson-section {
        margin-bottom: 2rem;
      }

      .section-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--text-primary, #111827);
      }

      .explanation {
        font-size: 1rem;
        line-height: 1.6;
        color: var(--text-primary, #111827);
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        border-left: 4px solid var(--accent-primary, #3b82f6);
      }

      .contrast-note {
        background: var(--bg-accent, #fef3c7);
        border: 1px solid var(--border-accent, #f59e0b);
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .examples-grid {
        display: grid;
        gap: 1rem;
        margin: 1rem 0;
      }

      .example {
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color, #e5e7eb);
      }

      .example-wrong {
        background: #fef2f2;
        border-color: #fca5a5;
      }

      .example-right {
        background: #f0fdf4;
        border-color: #86efac;
      }

      .example-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
      }

      .example-wrong .example-label {
        color: #dc2626;
      }

      .example-right .example-label {
        color: #16a34a;
      }

      .example-text {
        font-size: 1rem;
        color: var(--text-primary, #111827);
        margin-bottom: 0.25rem;
      }

      .example-translation {
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        font-style: italic;
      }

      .drill-container {
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        padding: 1.5rem;
        margin: 1rem 0;
      }

      .drill-question {
        font-size: 1.1rem;
        font-weight: 500;
        margin-bottom: 1rem;
        color: var(--text-primary, #111827);
      }

      .drill-options {
        display: grid;
        gap: 0.5rem;
      }

      .drill-option {
        padding: 0.75rem 1rem;
        border: 2px solid var(--border-color, #e5e7eb);
        border-radius: 8px;
        background: var(--bg-primary, #ffffff);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 1rem;
      }

      .drill-option:hover {
        border-color: var(--accent-primary, #3b82f6);
        background: var(--bg-hover, #f0f9ff);
      }

      .drill-option.selected {
        border-color: var(--accent-primary, #3b82f6);
        background: var(--bg-selected, #dbeafe);
      }

      .drill-option.correct {
        border-color: #16a34a;
        background: #f0fdf4;
      }

      .drill-option.incorrect {
        border-color: #dc2626;
        background: #fef2f2;
      }

      .drill-feedback {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 6px;
        font-size: 0.9rem;
        line-height: 1.5;
        display: none;
      }

      .drill-feedback.correct {
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #86efac;
      }

      .drill-feedback.incorrect {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fca5a5;
      }

      .memory-tip {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 12px;
        margin: 1rem 0;
        text-align: center;
      }

      .memory-tip-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        display: block;
      }

      .memory-tip-text {
        font-size: 1rem;
        font-weight: 500;
        line-height: 1.4;
      }

      .modal-footer {
        display: flex;
        justify-content: space-between;
        padding: 1rem 1.5rem 1.5rem;
        border-top: 1px solid var(--border-color, #e5e7eb);
        background: var(--bg-secondary, #f8fafc);
      }

      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-primary {
        background: var(--accent-primary, #3b82f6);
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background: var(--accent-primary-hover, #2563eb);
      }

      .btn-secondary {
        background: var(--bg-primary, #ffffff);
        color: var(--text-secondary, #6b7280);
        border: 1px solid var(--border-color, #e5e7eb);
      }

      .btn-secondary:hover {
        background: var(--bg-hover, #f9fafb);
        color: var(--text-primary, #111827);
      }

      @media (max-width: 640px) {
        .mini-lesson-modal {
          padding: 0.5rem;
        }

        .modal-content {
          max-height: 95vh;
        }

        .modal-header {
          padding: 1rem 1rem 0.5rem;
        }

        .modal-body {
          padding: 0.5rem 1rem;
        }

        .modal-footer {
          padding: 1rem;
        }

        .lesson-title {
          font-size: 1.1rem;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Close modal events
    this.modal.querySelector('.modal-close').addEventListener('click', () => {
      this.hide();
    });

    this.modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      this.hide();
    });

    // Footer buttons
    this.modal.querySelector('.lesson-skip').addEventListener('click', () => {
      this.skipLesson();
    });

    this.modal.querySelector('.lesson-continue').addEventListener('click', () => {
      this.nextStep();
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      if (e.key === 'Escape') {
        this.hide();
      } else if (e.key === 'Enter' && !this.modal.querySelector('.lesson-continue').disabled) {
        this.nextStep();
      }
    });
  }

  /**
   * Show the modal with a mini-lesson
   * @param {object} lesson - Mini-lesson object
   * @param {function} onComplete - Callback when lesson is completed
   */
  show(lesson, onComplete = null) {
    this.currentLesson = lesson;
    this.onComplete = onComplete;
    this.startTime = Date.now();
    this.drillResults = [];
    this.currentStep = 0;
    this.totalSteps = this.calculateTotalSteps(lesson);

    this.renderLesson();
    this.updateProgress();

    this.modal.classList.add('visible');
    this.isVisible = true;

    // Focus management
    this.modal.querySelector('.modal-content').focus();
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide the modal
   */
  hide() {
    this.modal.classList.remove('visible');
    this.isVisible = false;
    document.body.style.overflow = '';

    this.currentLesson = null;
    this.startTime = null;
    this.drillResults = [];
  }

  /**
   * Calculate total steps in the lesson
   */
  calculateTotalSteps(lesson) {
    let steps = 1; // Explanation step

    if (lesson.content.key_examples && lesson.content.key_examples.length > 0) {
      steps += 1; // Examples step
    }

    if (lesson.content.quick_drill && lesson.content.quick_drill.length > 0) {
      steps += lesson.content.quick_drill.length; // Each drill is a step
    }

    if (lesson.content.memory_tip) {
      steps += 1; // Memory tip step
    }

    return steps;
  }

  /**
   * Render the current lesson step
   */
  renderLesson() {
    const lesson = this.currentLesson;
    const content = lesson.content;
    const lessonContent = this.modal.querySelector('.lesson-content');

    // Set title
    this.modal.querySelector('.lesson-title').textContent =
      lesson.title_bg || lesson.title_en || lesson.id;

    // Render current step
    if (this.currentStep === 0) {
      // Step 1: Explanation
      this.renderExplanation(lessonContent, content);
    } else if (this.currentStep === 1 && content.key_examples) {
      // Step 2: Examples
      this.renderExamples(lessonContent, content);
    } else if (this.isQuickDrillStep()) {
      // Steps 3+: Quick drills
      const drillIndex = this.getDrillIndex();
      this.renderQuickDrill(lessonContent, content.quick_drill[drillIndex], drillIndex);
    } else {
      // Final step: Memory tip
      this.renderMemoryTip(lessonContent, content);
    }
  }

  /**
   * Render explanation section
   */
  renderExplanation(container, content) {
    container.innerHTML = `
      <div class="lesson-section">
        <h3 class="section-title">Обяснение</h3>
        <div class="explanation bg-text">
          ${content.micro_explanation_bg || content.micro_explanation_en || ''}
        </div>
        
        ${this.renderContrastNote(content)}
      </div>
    `;

    this.enableContinueButton();
  }

  /**
   * Render L1-specific contrast note
   */
  renderContrastNote(content) {
    if (!content.contrast_notes || !content.contrast_notes[this.userL1]) {
      return '';
    }

    return `
      <div class="contrast-note">
        <strong>За ${this.getL1Name()}:</strong> ${content.contrast_notes[this.userL1]}
      </div>
    `;
  }

  /**
   * Render examples section
   */
  renderExamples(container, content) {
    const examples = content.key_examples || [];

    const examplesHtml = examples
      .map(
        (example) => `
      <div class="examples-grid">
        ${
          example.wrong
            ? `
          <div class="example example-wrong">
            <div class="example-label">Неправилно</div>
            <div class="example-text bg-text">${example.wrong}</div>
          </div>
        `
            : ''
        }
        
        <div class="example example-right">
          <div class="example-label">Правилно</div>
          <div class="example-text bg-text">${example.right}</div>
          ${
            example.translation_en
              ? `
            <div class="example-translation">${example.translation_en}</div>
          `
              : ''
          }
        </div>
      </div>
    `
      )
      .join('');

    container.innerHTML = `
      <div class="lesson-section">
        <h3 class="section-title">Примери</h3>
        ${examplesHtml}
      </div>
    `;

    this.enableContinueButton();
  }

  /**
   * Render quick drill
   */
  renderQuickDrill(container, drill, drillIndex) {
    const optionsHtml = drill.options
      .map(
        (option, index) => `
      <div class="drill-option" data-option="${index}">
        ${option}
      </div>
    `
      )
      .join('');

    container.innerHTML = `
      <div class="lesson-section">
        <h3 class="section-title">Упражнение ${drillIndex + 1}</h3>
        <div class="drill-container">
          <div class="drill-question bg-text">${drill.prompt}</div>
          <div class="drill-options">
            ${optionsHtml}
          </div>
          <div class="drill-feedback"></div>
        </div>
      </div>
    `;

    // Bind drill option clicks
    container.querySelectorAll('.drill-option').forEach((option, index) => {
      option.addEventListener('click', () => {
        this.selectDrillOption(drill, index, drillIndex);
      });
    });

    this.disableContinueButton();
  }

  /**
   * Handle drill option selection
   */
  selectDrillOption(drill, selectedIndex, drillIndex) {
    const options = this.modal.querySelectorAll('.drill-option');
    const feedback = this.modal.querySelector('.drill-feedback');
    const isCorrect = selectedIndex === drill.correct;

    // Clear previous selections
    options.forEach((option) => {
      option.classList.remove('selected', 'correct', 'incorrect');
    });

    // Mark selected option
    options[selectedIndex].classList.add('selected');

    if (isCorrect) {
      options[selectedIndex].classList.add('correct');
      feedback.className = 'drill-feedback correct';
      feedback.textContent = `✓ Правилно! ${drill.explanation || ''}`;
    } else {
      options[selectedIndex].classList.add('incorrect');
      options[drill.correct].classList.add('correct');
      feedback.className = 'drill-feedback incorrect';
      feedback.textContent = `✗ Опитай отново. Правилният отговор е: ${drill.options[drill.correct]}`;
    }

    feedback.style.display = 'block';

    // Record drill result
    this.drillResults.push({
      drillIndex,
      selectedIndex,
      correctIndex: drill.correct,
      isCorrect,
      responseTime: Date.now() - this.stepStartTime,
    });

    if (isCorrect) {
      this.enableContinueButton();
    } else {
      // Allow retry after 2 seconds
      setTimeout(() => {
        this.enableContinueButton();
      }, 2000);
    }
  }

  /**
   * Render memory tip
   */
  renderMemoryTip(container, content) {
    if (!content.memory_tip) {
      this.completeLesson();
      return;
    }

    container.innerHTML = `
      <div class="lesson-section">
        <div class="memory-tip">
          <span class="memory-tip-icon">💡</span>
          <div class="memory-tip-text bg-text">${content.memory_tip}</div>
        </div>
      </div>
    `;

    this.enableContinueButton();

    // Change continue button text to "Завърши"
    this.modal.querySelector('.lesson-continue').textContent = 'Завърши';
  }

  /**
   * Move to next step
   */
  nextStep() {
    this.stepStartTime = Date.now();
    this.currentStep++;
    this.updateProgress();

    if (this.currentStep >= this.totalSteps) {
      this.completeLesson();
    } else {
      this.renderLesson();
    }
  }

  /**
   * Skip lesson
   */
  skipLesson() {
    this.hide();

    if (this.onComplete) {
      this.onComplete(this.currentLesson.id, {
        accuracyScore: 0,
        timeSpentMs: Date.now() - this.startTime,
        drillResults: this.drillResults,
        completed: false,
        skipped: true,
      });
    }
  }

  /**
   * Complete lesson
   */
  completeLesson() {
    const timeSpentMs = Date.now() - this.startTime;
    const totalDrills = this.drillResults.length;
    const correctDrills = this.drillResults.filter((r) => r.isCorrect).length;
    const accuracyScore = totalDrills > 0 ? correctDrills / totalDrills : 1;

    this.hide();

    if (this.onComplete) {
      this.onComplete(this.currentLesson.id, {
        accuracyScore,
        timeSpentMs,
        drillResults: this.drillResults,
        completed: true,
        skipped: false,
      });
    }
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    const progressFill = this.modal.querySelector('.progress-fill');
    const progressText = this.modal.querySelector('.progress-text');

    const progress = (this.currentStep / this.totalSteps) * 100;
    progressFill.style.width = `${Math.min(progress, 100)}%`;
    progressText.textContent = `${Math.min(this.currentStep, this.totalSteps)} / ${this.totalSteps}`;
  }

  /**
   * Enable/disable continue button
   */
  enableContinueButton() {
    this.modal.querySelector('.lesson-continue').disabled = false;
  }

  disableContinueButton() {
    this.modal.querySelector('.lesson-continue').disabled = true;
  }

  /**
   * Helper methods
   */
  isQuickDrillStep() {
    const lesson = this.currentLesson;
    const hasExamples = lesson.content.key_examples && lesson.content.key_examples.length > 0;
    const drillStartStep = hasExamples ? 2 : 1;
    const drillCount = lesson.content.quick_drill ? lesson.content.quick_drill.length : 0;

    return this.currentStep >= drillStartStep && this.currentStep < drillStartStep + drillCount;
  }

  getDrillIndex() {
    const lesson = this.currentLesson;
    const hasExamples = lesson.content.key_examples && lesson.content.key_examples.length > 0;
    const drillStartStep = hasExamples ? 2 : 1;

    return this.currentStep - drillStartStep;
  }

  getUserL1Language() {
    // Get from localStorage or default to Polish
    try {
      const settings = JSON.parse(localStorage.getItem('bulgarian_coach_settings'));
      return settings?.l1Language || 'PL';
    } catch {
      return 'PL';
    }
  }

  getL1Name() {
    const names = {
      PL: 'полски',
      RU: 'руски',
      UK: 'украински',
      SR: 'сръбски',
    };
    return names[this.userL1] || 'други езици';
  }
}

// Export for use in main application
export default MiniLessonModal;
