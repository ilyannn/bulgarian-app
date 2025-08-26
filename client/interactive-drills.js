/**
 * Interactive Drill Practice System
 *
 * Features:
 * - Interactive drill practice with voice input
 * - Spaced repetition system (SRS) tracking
 * - Real-time feedback and correction
 * - Progress visualization
 * - Multiple practice modes
 */

export class InteractiveDrillSystem {
  constructor() {
    this.drills = new Map(); // Current drill set
    this.progress = new Map(); // User progress per drill
    this.currentDrill = null;
    this.currentMode = 'practice'; // practice, review, challenge
    this.isActive = false;
    this.userInput = '';
    this.attempts = 0;
    this.maxAttempts = 3;

    // SRS intervals in days
    this.srsIntervals = [1, 3, 7, 21, 60, 120];
    this.currentInterval = 0;

    // Audio feedback
    this.audioContext = null;

    // UI elements
    this.drillContainer = null;
    this.practiceButton = null;
    this.inputField = null;
    this.feedbackArea = null;
    this.progressBar = null;
    this.micButton = null;

    this.init();
  }

  init() {
    this.injectStyles();
    this.loadProgress();
    this.setupEventListeners();
  }

  injectStyles() {
    const styles = `
      /* Interactive Drill System Styles */
      .drill-practice-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
      }
      
      .drill-practice-modal.active {
        display: flex;
      }
      
      .drill-practice-container {
        background: white;
        border-radius: 20px;
        padding: 2rem;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-50px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .drill-header {
        text-align: center;
        margin-bottom: 2rem;
        border-bottom: 2px solid #f0f0f0;
        padding-bottom: 1rem;
      }
      
      .drill-title {
        font-size: 1.5rem;
        color: #333;
        margin-bottom: 0.5rem;
        font-weight: 600;
      }
      
      .drill-level {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 15px;
        font-size: 0.85rem;
        font-weight: 500;
      }
      
      .drill-progress {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .drill-progress-label {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 0.5rem;
      }
      
      .drill-progress-bar {
        background: #e9ecef;
        border-radius: 8px;
        height: 8px;
        overflow: hidden;
        position: relative;
      }
      
      .drill-progress-fill {
        background: linear-gradient(90deg, #4ade80, #22c55e);
        height: 100%;
        border-radius: 8px;
        transition: width 0.3s ease;
        width: 0%;
      }
      
      .drill-question-area {
        background: rgba(102, 126, 234, 0.1);
        border-radius: 15px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border-left: 4px solid #667eea;
      }
      
      .drill-prompt {
        font-size: 1.2rem;
        font-weight: 500;
        color: #333;
        margin-bottom: 1rem;
        line-height: 1.6;
      }
      
      .drill-hint {
        font-size: 0.9rem;
        color: #666;
        font-style: italic;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .drill-hint.visible {
        opacity: 1;
      }
      
      .drill-input-area {
        margin-bottom: 1.5rem;
      }
      
      .drill-input-container {
        position: relative;
        display: flex;
        gap: 0.75rem;
        align-items: stretch;
      }
      
      .drill-input {
        flex: 1;
        padding: 1rem;
        border: 2px solid #e9ecef;
        border-radius: 12px;
        font-size: 1.1rem;
        font-family: inherit;
        transition: all 0.3s ease;
        background: white;
      }
      
      .drill-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .drill-input.correct {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.05);
      }
      
      .drill-input.incorrect {
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.05);
        animation: shake 0.5s ease-in-out;
      }
      
      @keyframes shake {
        0%, 20%, 40%, 60%, 80%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      }
      
      .drill-mic-btn {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .drill-mic-btn:hover {
        transform: scale(1.05);
      }
      
      .drill-mic-btn.recording {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        animation: pulse 1.5s infinite;
      }
      
      .drill-feedback {
        min-height: 60px;
        padding: 1rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        transition: all 0.3s ease;
        display: none;
      }
      
      .drill-feedback.visible {
        display: block;
        animation: slideDown 0.3s ease-out;
      }
      
      .drill-feedback.correct {
        background: rgba(34, 197, 94, 0.1);
        border: 2px solid #22c55e;
        color: #15803d;
      }
      
      .drill-feedback.incorrect {
        background: rgba(239, 68, 68, 0.1);
        border: 2px solid #ef4444;
        color: #dc2626;
      }
      
      .drill-feedback.partial {
        background: rgba(251, 191, 36, 0.1);
        border: 2px solid #fbbf24;
        color: #92400e;
      }
      
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .drill-feedback-icon {
        font-size: 1.2rem;
        margin-right: 0.5rem;
      }
      
      .drill-actions {
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        align-items: center;
      }
      
      .drill-btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 10px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .drill-btn-primary {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
      }
      
      .drill-btn-secondary {
        background: #6c757d;
        color: white;
      }
      
      .drill-btn-success {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }
      
      .drill-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      }
      
      .drill-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      
      .drill-stats {
        display: flex;
        justify-content: space-around;
        background: #f8f9fa;
        border-radius: 12px;
        padding: 1rem;
        margin-top: 1rem;
        font-size: 0.9rem;
      }
      
      .drill-stat {
        text-align: center;
      }
      
      .drill-stat-value {
        font-size: 1.2rem;
        font-weight: 600;
        color: #667eea;
        display: block;
      }
      
      .drill-stat-label {
        color: #666;
        margin-top: 0.2rem;
      }
      
      .drill-close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        width: 30px;
        height: 30px;
        border: none;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        font-size: 1.2rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .drill-close-btn:hover {
        background: rgba(0, 0, 0, 0.2);
        transform: scale(1.1);
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .drill-practice-container {
          margin: 1rem;
          padding: 1.5rem;
          width: calc(100% - 2rem);
        }
        
        .drill-actions {
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .drill-btn {
          width: 100%;
          justify-content: center;
        }
        
        .drill-input-container {
          flex-direction: column;
        }
        
        .drill-mic-btn {
          align-self: center;
        }
      }
      
      /* Dark mode support */
      [data-theme="dark"] .drill-practice-container {
        background: #1f2937;
        color: #f3f4f6;
      }
      
      [data-theme="dark"] .drill-header {
        border-bottom-color: #374151;
      }
      
      [data-theme="dark"] .drill-title {
        color: #f3f4f6;
      }
      
      [data-theme="dark"] .drill-progress,
      [data-theme="dark"] .drill-stats {
        background: #374151;
      }
      
      [data-theme="dark"] .drill-input {
        background: #374151;
        border-color: #4b5563;
        color: #f3f4f6;
      }
      
      [data-theme="dark"] .drill-input:focus {
        border-color: #667eea;
        background: #374151;
      }
      
      [data-theme="dark"] .drill-prompt {
        color: #f3f4f6;
      }
      
      [data-theme="dark"] .drill-hint {
        color: #9ca3af;
      }
      
      [data-theme="dark"] .drill-close-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #f3f4f6;
      }
      
      [data-theme="dark"] .drill-close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  setupEventListeners() {
    // Listen for drill practice requests
    document.addEventListener('startDrillPractice', (event) => {
      this.startPractice(event.detail.drills, event.detail.mode);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (this.isActive) {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closePractice();
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          this.checkAnswer();
        } else if (event.ctrlKey && event.key === 'h') {
          event.preventDefault();
          this.showHint();
        }
      }
    });
  }

  startPractice(drills, mode = 'practice') {
    this.drills.clear();
    this.currentMode = mode;
    this.isActive = true;

    // Process drills into our internal format
    drills.forEach((drill, index) => {
      const drillId = drill.id || `drill_${index}`;
      this.drills.set(drillId, {
        id: drillId,
        prompt: drill.prompt_bg || drill.prompt,
        answer: drill.answer_bg || drill.answer,
        level: drill.level || 'A2',
        type: drill.type || 'transform',
        hint: drill.hint || '',
        grammarPoint: drill.grammarPoint || '',
        ...drill,
      });
    });

    this.createPracticeModal();
    this.nextDrill();
  }

  createPracticeModal() {
    // Remove existing modal if any
    const existingModal = document.querySelector('.drill-practice-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'drill-practice-modal';
    modal.innerHTML = `
      <div class="drill-practice-container">
        <button class="drill-close-btn" title="Close practice">×</button>
        
        <div class="drill-header">
          <div class="drill-title">Interactive Drill Practice</div>
          <div class="drill-level">Level A2</div>
        </div>
        
        <div class="drill-progress">
          <div class="drill-progress-label">Progress: <span class="drill-current">1</span> of <span class="drill-total">5</span></div>
          <div class="drill-progress-bar">
            <div class="drill-progress-fill"></div>
          </div>
        </div>
        
        <div class="drill-question-area">
          <div class="drill-prompt">Loading drill...</div>
          <div class="drill-hint"></div>
        </div>
        
        <div class="drill-input-area">
          <div class="drill-input-container">
            <input 
              type="text" 
              class="drill-input" 
              placeholder="Type your answer here..."
              autocomplete="off"
            >
            <button class="drill-mic-btn" title="Use voice input">🎤</button>
          </div>
        </div>
        
        <div class="drill-feedback"></div>
        
        <div class="drill-actions">
          <div class="drill-action-left">
            <button class="drill-btn drill-btn-secondary" id="drill-hint-btn">
              💡 Hint
            </button>
            <button class="drill-btn drill-btn-secondary" id="drill-skip-btn">
              ⏭️ Skip
            </button>
          </div>
          
          <div class="drill-action-right">
            <button class="drill-btn drill-btn-primary" id="drill-check-btn">
              ✓ Check Answer
            </button>
            <button class="drill-btn drill-btn-success" id="drill-next-btn" style="display: none;">
              → Next Drill
            </button>
          </div>
        </div>
        
        <div class="drill-stats">
          <div class="drill-stat">
            <span class="drill-stat-value" id="drill-correct-count">0</span>
            <div class="drill-stat-label">Correct</div>
          </div>
          <div class="drill-stat">
            <span class="drill-stat-value" id="drill-attempts-count">0</span>
            <div class="drill-stat-label">Attempts</div>
          </div>
          <div class="drill-stat">
            <span class="drill-stat-value" id="drill-accuracy">100%</span>
            <div class="drill-stat-label">Accuracy</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Cache UI elements
    this.drillContainer = modal;
    this.inputField = modal.querySelector('.drill-input');
    this.feedbackArea = modal.querySelector('.drill-feedback');
    this.progressBar = modal.querySelector('.drill-progress-fill');
    this.micButton = modal.querySelector('.drill-mic-btn');

    // Setup event listeners
    modal.querySelector('.drill-close-btn').addEventListener('click', () => this.closePractice());
    modal.querySelector('#drill-check-btn').addEventListener('click', () => this.checkAnswer());
    modal.querySelector('#drill-next-btn').addEventListener('click', () => this.nextDrill());
    modal.querySelector('#drill-hint-btn').addEventListener('click', () => this.showHint());
    modal.querySelector('#drill-skip-btn').addEventListener('click', () => this.skipDrill());

    this.micButton.addEventListener('click', () => this.toggleVoiceInput());

    this.inputField.addEventListener('input', () => {
      // Clear previous feedback when user starts typing
      this.hideFeedback();
      this.inputField.classList.remove('correct', 'incorrect');
    });

    // Show modal
    setTimeout(() => {
      modal.classList.add('active');
      this.inputField.focus();
    }, 50);
  }

  nextDrill() {
    const drillIds = Array.from(this.drills.keys());

    if (drillIds.length === 0) {
      this.completePractice();
      return;
    }

    // Get next drill (for now, just pick the first one)
    const nextDrillId = drillIds[0];
    this.currentDrill = this.drills.get(nextDrillId);
    this.drills.delete(nextDrillId);

    this.attempts = 0;
    this.userInput = '';

    this.displayDrill();
    this.updateProgress();
    this.inputField.value = '';
    this.inputField.focus();
    this.hideFeedback();
    this.hideHint();

    // Update buttons
    document.querySelector('#drill-check-btn').style.display = 'inline-flex';
    document.querySelector('#drill-next-btn').style.display = 'none';
  }

  displayDrill() {
    if (!this.currentDrill) return;

    const promptElement = document.querySelector('.drill-prompt');
    const levelElement = document.querySelector('.drill-level');
    const hintElement = document.querySelector('.drill-hint');

    promptElement.textContent = this.currentDrill.prompt;
    levelElement.textContent = `Level ${this.currentDrill.level}`;

    if (this.currentDrill.hint) {
      hintElement.textContent = this.currentDrill.hint;
    }
  }

  updateProgress() {
    const totalDrills = this.drills.size + 1; // +1 for current drill
    const currentIndex = totalDrills - this.drills.size;

    document.querySelector('.drill-current').textContent = currentIndex;
    document.querySelector('.drill-total').textContent = totalDrills;

    const progressPercent = ((currentIndex - 1) / totalDrills) * 100;
    this.progressBar.style.width = `${progressPercent}%`;
  }

  checkAnswer() {
    if (!this.currentDrill) return;

    this.attempts++;
    this.userInput = this.inputField.value.trim();

    if (!this.userInput) {
      this.showFeedback('Please enter an answer', 'incorrect', '❌');
      return;
    }

    const result = this.evaluateAnswer(this.userInput, this.currentDrill.answer);

    this.updateStats();

    if (result.correct) {
      this.showFeedback(result.message, 'correct', '✅');
      this.inputField.classList.add('correct');
      this.recordProgress(true);

      // Enable next button
      document.querySelector('#drill-check-btn').style.display = 'none';
      document.querySelector('#drill-next-btn').style.display = 'inline-flex';
    } else if (result.partial) {
      this.showFeedback(result.message, 'partial', '⚠️');
      this.inputField.classList.add('incorrect');

      if (this.attempts >= this.maxAttempts) {
        this.showCorrectAnswer();
      }
    } else {
      this.showFeedback(result.message, 'incorrect', '❌');
      this.inputField.classList.add('incorrect');

      if (this.attempts >= this.maxAttempts) {
        this.showCorrectAnswer();
      } else {
        // Give hint after 2 attempts
        if (this.attempts >= 2) {
          this.showHint();
        }
      }
    }
  }

  evaluateAnswer(userAnswer, correctAnswer) {
    // Normalize answers for comparison
    const normalizedUser = this.normalizeAnswer(userAnswer);
    const normalizedCorrect = this.normalizeAnswer(correctAnswer);

    if (normalizedUser === normalizedCorrect) {
      return {
        correct: true,
        message: "Perfect! That's the correct answer.",
        score: 100,
      };
    }

    // Check for partial matches
    const similarity = this.calculateSimilarity(normalizedUser, normalizedCorrect);

    if (similarity > 0.8) {
      return {
        correct: false,
        partial: true,
        message: 'Close! Check your spelling and grammar.',
        score: Math.round(similarity * 100),
      };
    }
    if (similarity > 0.5) {
      return {
        correct: false,
        partial: true,
        message: "You're on the right track, but there are some errors.",
        score: Math.round(similarity * 100),
      };
    }
    return {
      correct: false,
      message: "That's not quite right. Try again!",
      score: 0,
    };
  }

  normalizeAnswer(answer) {
    return answer
      .toLowerCase()
      .trim()
      .replace(/[^\u0400-\u04FF\w\s]/g, '') // Keep only Cyrillic, Latin, digits, whitespace
      .replace(/\s+/g, ' ');
  }

  calculateSimilarity(str1, str2) {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  showFeedback(message, type, icon) {
    this.feedbackArea.innerHTML = `
      <span class="drill-feedback-icon">${icon}</span>
      ${message}
    `;
    this.feedbackArea.className = `drill-feedback ${type} visible`;
  }

  hideFeedback() {
    this.feedbackArea.classList.remove('visible');
  }

  showHint() {
    const hintElement = document.querySelector('.drill-hint');
    if (hintElement && this.currentDrill.hint) {
      hintElement.classList.add('visible');
    }
  }

  hideHint() {
    const hintElement = document.querySelector('.drill-hint');
    if (hintElement) {
      hintElement.classList.remove('visible');
    }
  }

  showCorrectAnswer() {
    this.showFeedback(
      `The correct answer is: <strong>${this.currentDrill.answer}</strong>`,
      'correct',
      '💡'
    );
    this.recordProgress(false);

    // Enable next button
    document.querySelector('#drill-check-btn').style.display = 'none';
    document.querySelector('#drill-next-btn').style.display = 'inline-flex';
  }

  skipDrill() {
    this.recordProgress(false);
    this.nextDrill();
  }

  toggleVoiceInput() {
    if (this.micButton.classList.contains('recording')) {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  startVoiceRecording() {
    // Trigger main app's microphone if available
    if (window.startRecording) {
      this.micButton.classList.add('recording');
      this.micButton.title = 'Stop recording';

      // Listen for voice input
      const handleVoiceInput = (event) => {
        if (event.detail?.text) {
          this.inputField.value = event.detail.text;
          this.stopVoiceRecording();
          document.removeEventListener('voiceInput', handleVoiceInput);
        }
      };

      document.addEventListener('voiceInput', handleVoiceInput);
      window.startRecording();
    } else {
      this.showNotification('Voice input not available', 'error');
    }
  }

  stopVoiceRecording() {
    if (window.stopRecording) {
      window.stopRecording();
    }

    this.micButton.classList.remove('recording');
    this.micButton.title = 'Use voice input';
  }

  recordProgress(correct) {
    const drillId = this.currentDrill.id;

    if (!this.progress.has(drillId)) {
      this.progress.set(drillId, {
        attempts: 0,
        correct: 0,
        lastPracticed: Date.now(),
        interval: 0,
        nextReview: Date.now(),
      });
    }

    const progress = this.progress.get(drillId);
    progress.attempts++;
    progress.lastPracticed = Date.now();

    if (correct) {
      progress.correct++;
      // Advance SRS interval
      if (progress.interval < this.srsIntervals.length - 1) {
        progress.interval++;
      }
    } else {
      // Reset SRS interval on wrong answer
      progress.interval = Math.max(0, progress.interval - 1);
    }

    // Calculate next review date
    const intervalDays = this.srsIntervals[progress.interval];
    progress.nextReview = Date.now() + intervalDays * 24 * 60 * 60 * 1000;

    this.saveProgress();
  }

  updateStats() {
    let totalCorrect = 0;
    let totalAttempts = 0;

    for (const progress of this.progress.values()) {
      totalCorrect += progress.correct;
      totalAttempts += progress.attempts;
    }

    // Add current session
    totalAttempts += this.attempts;
    if (document.querySelector('.drill-feedback.correct')) {
      totalCorrect++;
    }

    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 100;

    document.querySelector('#drill-correct-count').textContent = totalCorrect;
    document.querySelector('#drill-attempts-count').textContent = totalAttempts;
    document.querySelector('#drill-accuracy').textContent = `${accuracy}%`;
  }

  completePractice() {
    const stats = this.calculateSessionStats();

    const completionMessage = `
      <div style="text-align: center; padding: 2rem;">
        <h2>🎉 Practice Complete!</h2>
        <p>Great job! You completed ${stats.totalDrills} drills.</p>
        <div style="margin: 1rem 0;">
          <strong>Session Stats:</strong><br>
          Accuracy: ${stats.accuracy}%<br>
          Correct: ${stats.correct}/${stats.total}
        </div>
        <p>Keep practicing to improve your Bulgarian!</p>
      </div>
    `;

    this.drillContainer.querySelector('.drill-practice-container').innerHTML = completionMessage;

    setTimeout(() => {
      this.closePractice();
    }, 3000);
  }

  calculateSessionStats() {
    let totalCorrect = 0;
    let totalAttempts = 0;
    const totalDrills = this.progress.size;

    for (const progress of this.progress.values()) {
      totalCorrect += progress.correct;
      totalAttempts += progress.attempts;
    }

    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 100;

    return {
      totalDrills,
      correct: totalCorrect,
      total: totalAttempts,
      accuracy,
    };
  }

  closePractice() {
    this.isActive = false;
    this.currentDrill = null;
    this.stopVoiceRecording();

    if (this.drillContainer) {
      this.drillContainer.classList.remove('active');
      setTimeout(() => {
        this.drillContainer.remove();
        this.drillContainer = null;
      }, 300);
    }
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('drillProgress');
      if (saved) {
        const progressData = JSON.parse(saved);
        this.progress = new Map(Object.entries(progressData));
      }
    } catch (error) {
      console.warn('Failed to load drill progress:', error);
    }
  }

  saveProgress() {
    try {
      const progressData = Object.fromEntries(this.progress);
      localStorage.setItem('drillProgress', JSON.stringify(progressData));
    } catch (error) {
      console.warn('Failed to save drill progress:', error);
    }
  }

  showNotification(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // Public API methods
  getDrillsForReview() {
    const now = Date.now();
    const reviewDrills = [];

    this.progress.forEach((progress, drillId) => {
      if (progress.nextReview <= now) {
        reviewDrills.push(drillId);
      }
    });

    return reviewDrills;
  }

  getProgress() {
    return Object.fromEntries(this.progress);
  }

  resetProgress() {
    this.progress.clear();
    localStorage.removeItem('drillProgress');
  }

  exportProgress() {
    return {
      progress: this.getProgress(),
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
  }

  importProgress(data) {
    if (data.progress) {
      this.progress = new Map(Object.entries(data.progress));
      this.saveProgress();
    }
  }

  destroy() {
    this.closePractice();
    this.progress.clear();
    console.log('InteractiveDrillSystem destroyed');
  }
}

// Auto-initialize when loaded (skip in test environments)
if (typeof document !== 'undefined' && !globalThis.process?.env?.NODE_ENV?.includes('test')) {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.interactiveDrills) {
      window.interactiveDrills = new InteractiveDrillSystem();
    }
  });

  // Also initialize immediately if DOM already loaded
  if (document.readyState === 'loading') {
    // DOM is still loading
  } else {
    // DOM is already loaded
    if (!window.interactiveDrills) {
      window.interactiveDrills = new InteractiveDrillSystem();
    }
  }
}

export default InteractiveDrillSystem;
