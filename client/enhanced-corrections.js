/**
 * Enhanced Grammar Corrections System
 * Provides rich visual feedback and interactive learning features for Bulgarian grammar corrections
 */

export class EnhancedCorrectionsSystem {
  constructor() {
    this.corrections = new Map();
    this.correctionHistory = [];
    this.isHighlightMode = false;
    this.audioContext = null;

    this.initializeEventListeners();
    this.injectStyles();
  }

  /**
   * Initialize event listeners for correction interactions
   */
  initializeEventListeners() {
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key === 'h' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.toggleHighlightMode();
      }
    });

    // Listen for correction clicks globally
    document.addEventListener('click', (event) => {
      if (event.target.matches('.correction-chip-enhanced')) {
        event.preventDefault();
        const correctionId = event.target.dataset.correctionId;
        this.handleCorrectionClick(correctionId);
      }
    });
  }

  /**
   * Inject enhanced styles for corrections
   */
  injectStyles() {
    const styles = `
      .correction-chip-enhanced {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: linear-gradient(135deg, #ff6b6b, #ffd93d);
        color: #2d3436;
        padding: 0.4rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        margin: 0.2rem;
        cursor: pointer;
        transition: all 0.3s ease;
        border: 2px solid transparent;
        position: relative;
        overflow: hidden;
      }

      .correction-chip-enhanced::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
        border-radius: 20px;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .correction-chip-enhanced:hover::before {
        opacity: 1;
      }

      .correction-chip-enhanced:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
      }

      .correction-severity-high {
        background: linear-gradient(135deg, #e74c3c, #f39c12);
        animation: pulse-severe 2s infinite;
      }

      .correction-severity-medium {
        background: linear-gradient(135deg, #f39c12, #f1c40f);
      }

      .correction-severity-low {
        background: linear-gradient(135deg, #2ecc71, #27ae60);
      }

      @keyframes pulse-severe {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .correction-details-enhanced {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        padding: 1.2rem;
        margin: 0.8rem 0;
        position: relative;
        overflow: hidden;
        transform: translateY(-10px);
        opacity: 0;
        animation: slideInDown 0.4s ease forwards;
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
      }

      .correction-details-enhanced::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transform: rotate(45deg);
        transition: all 0.6s ease;
      }

      .correction-details-enhanced:hover::before {
        left: 100%;
      }

      @keyframes slideInDown {
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .correction-example {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 0.8rem;
        margin: 0.8rem 0;
        border-left: 4px solid #4ecdc4;
      }

      .correction-practice-btn {
        background: linear-gradient(135deg, #4ecdc4, #44a08d);
        color: white;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s ease;
        margin-top: 0.8rem;
      }

      .correction-practice-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
      }

      .highlight-mode .correction-chip-enhanced {
        animation: glow 1.5s ease-in-out infinite alternate;
      }

      @keyframes glow {
        from {
          box-shadow: 0 0 5px rgba(255, 107, 107, 0.5);
        }
        to {
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.8), 0 0 30px rgba(255, 107, 107, 0.6);
        }
      }

      .correction-stats {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.1);
        padding: 0.5rem;
        border-radius: 8px;
        font-size: 0.8rem;
        margin-top: 0.5rem;
      }

      .correction-audio-btn {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.3rem;
        border-radius: 50%;
        transition: all 0.2s ease;
      }

      .correction-audio-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
      }

      .correction-progress {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
        margin: 0.5rem 0;
      }

      .correction-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4ecdc4, #44a08d);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * Process and enhance corrections from the server
   * @param {Array} corrections - Array of correction objects
   * @returns {string} Enhanced HTML for corrections
   */
  processCorrections(corrections) {
    if (!corrections || corrections.length === 0) {
      return '';
    }

    let html = '<div class="corrections-enhanced">';
    html += '<h4 style="margin-bottom: 0.8rem; color: #666;">📚 Grammar Corrections</h4>';

    for (const [index, correction] of corrections.entries()) {
      const correctionId = this.generateCorrectionId(correction);
      const severity = this.determineSeverity(correction);

      this.corrections.set(correctionId, {
        ...correction,
        index,
        severity,
        timestamp: Date.now(),
        practiceCount: 0,
        isVisible: false,
      });

      html += this.renderCorrectionChip(correction, correctionId, severity);
    }

    html += '</div>';
    html += this.renderCorrectionDetails(corrections);

    return html;
  }

  /**
   * Generate unique ID for a correction
   * @param {Object} correction - Correction object
   * @returns {string} Unique correction ID
   */
  generateCorrectionId(correction) {
    const content = `${correction.before}_${correction.after}_${correction.type}`;
    return btoa(content)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16);
  }

  /**
   * Determine correction severity based on type and frequency
   * @param {Object} correction - Correction object
   * @returns {string} Severity level (high, medium, low)
   */
  determineSeverity(correction) {
    const highSeverityTypes = ['grammar', 'syntax', 'verb_conjugation'];
    const mediumSeverityTypes = ['vocabulary', 'preposition', 'case'];

    if (highSeverityTypes.includes(correction.type)) {
      return 'high';
    }
    if (mediumSeverityTypes.includes(correction.type)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Render correction chip with enhanced styling
   * @param {Object} correction - Correction object
   * @param {string} correctionId - Unique ID
   * @param {string} severity - Severity level
   * @returns {string} HTML for correction chip
   */
  renderCorrectionChip(correction, correctionId, severity) {
    const icon = this.getSeverityIcon(severity);
    return `
      <span class="correction-chip-enhanced correction-severity-${severity}" 
            data-correction-id="${correctionId}"
            title="Click to see detailed explanation">
        ${icon} ${correction.before} → <strong>${correction.after}</strong>
      </span>
    `;
  }

  /**
   * Get icon for severity level
   * @param {string} severity - Severity level
   * @returns {string} Icon character
   */
  getSeverityIcon(severity) {
    const icons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
    };
    return icons[severity] || '⚪';
  }

  /**
   * Render detailed correction explanations
   * @param {Array} corrections - Array of corrections
   * @returns {string} HTML for correction details
   */
  renderCorrectionDetails(corrections) {
    let html = '';

    for (const correction of corrections) {
      const correctionId = this.generateCorrectionId(correction);
      const severity = this.determineSeverity(correction);

      html += `
        <div class="correction-details-enhanced" 
             id="correction-details-${correctionId}" 
             style="display: none;">
          
          <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
            <h4 style="margin: 0; color: #4ecdc4;">
              ${this.getSeverityIcon(severity)} ${correction.type.replace('_', ' ').toUpperCase()}
            </h4>
            <button class="correction-audio-btn" onclick="enhancedCorrections.playCorrection('${correctionId}')">
              🔊
            </button>
          </div>

          <div class="correction-example">
            <div><strong>Before:</strong> <span class="bg-text" style="color: #e74c3c;">${correction.before}</span></div>
            <div><strong>After:</strong> <span class="bg-text" style="color: #2ecc71;">${correction.after}</span></div>
          </div>

          <div style="margin: 1rem 0;">
            <strong>Explanation:</strong><br>
            ${correction.note || 'This correction improves the grammatical accuracy of your Bulgarian.'}
          </div>

          ${
            correction.example
              ? `
            <div class="correction-example">
              <strong>Example:</strong><br>
              <span class="bg-text">${correction.example}</span>
            </div>
          `
              : ''
          }

          <div class="correction-stats">
            <span>Severity: ${severity.toUpperCase()}</span>
            <span>Practice: ${this.getPracticeCount(correctionId)}/5</span>
          </div>

          <div class="correction-progress">
            <div class="correction-progress-bar" style="width: ${(this.getPracticeCount(correctionId) / 5) * 100}%"></div>
          </div>

          <button class="correction-practice-btn" onclick="enhancedCorrections.startPractice('${correctionId}')">
            🎯 Practice This Rule
          </button>
        </div>
      `;
    }

    return html;
  }

  /**
   * Handle correction chip click
   * @param {string} correctionId - Correction ID
   */
  handleCorrectionClick(correctionId) {
    const correction = this.corrections.get(correctionId);
    if (!correction) return;

    const detailsElement = document.getElementById(`correction-details-${correctionId}`);
    if (!detailsElement) return;

    const isVisible = detailsElement.style.display !== 'none';

    // Hide all other correction details
    for (const el of document.querySelectorAll('.correction-details-enhanced')) {
      el.style.display = 'none';
    }

    if (!isVisible) {
      detailsElement.style.display = 'block';
      correction.isVisible = true;

      // Track interaction
      this.trackCorrectionInteraction(correctionId, 'view');

      // Add to history
      this.correctionHistory.push({
        correctionId,
        action: 'view',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Toggle highlight mode for all corrections
   */
  toggleHighlightMode() {
    this.isHighlightMode = !this.isHighlightMode;
    document.body.classList.toggle('highlight-mode', this.isHighlightMode);

    // Show toast notification
    this.showNotification(
      this.isHighlightMode
        ? 'Highlight mode enabled! Press Ctrl/Cmd+H to toggle.'
        : 'Highlight mode disabled.',
      'info'
    );
  }

  /**
   * Play audio for correction (TTS)
   * @param {string} correctionId - Correction ID
   */
  async playCorrection(correctionId) {
    const correction = this.corrections.get(correctionId);
    if (!correction) return;

    try {
      // Call TTS API for the correct pronunciation
      const response = await fetch('/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: correction.after,
          voice: 'bg',
          speed: 0.8,
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.play();
        audio.onended = () => URL.revokeObjectURL(audioUrl);

        this.trackCorrectionInteraction(correctionId, 'audio');
      }
    } catch (error) {
      console.warn('TTS not available:', error);
      this.showNotification('Audio playback not available', 'error');
    }
  }

  /**
   * Start practice mode for a correction
   * @param {string} correctionId - Correction ID
   */
  startPractice(correctionId) {
    const correction = this.corrections.get(correctionId);
    if (!correction) return;

    // Increment practice count
    correction.practiceCount += 1;

    // Update progress bar
    const progressBar = document.querySelector(
      `#correction-details-${correctionId} .correction-progress-bar`
    );
    if (progressBar) {
      progressBar.style.width = `${(correction.practiceCount / 5) * 100}%`;
    }

    // Show practice prompt
    this.showPracticePrompt(correction);
    this.trackCorrectionInteraction(correctionId, 'practice');
  }

  /**
   * Show practice prompt for correction
   * @param {Object} correction - Correction object
   */
  showPracticePrompt(correction) {
    const prompt = `Try using the correct form: "${correction.after}" in a sentence.`;
    this.showNotification(prompt, 'info', 5000);

    // Focus on mic button to encourage practice
    const micButton = document.getElementById('mic-button');
    if (micButton) {
      micButton.style.animation = 'pulse 1s ease-in-out 3';
    }
  }

  /**
   * Track correction interaction for analytics
   * @param {string} correctionId - Correction ID
   * @param {string} action - Action type
   */
  trackCorrectionInteraction(correctionId, action) {
    // Store interaction data
    const interaction = {
      correctionId,
      action,
      timestamp: Date.now(),
    };

    // Could send to analytics API
    console.log('Correction interaction:', interaction);
  }

  /**
   * Get practice count for a correction
   * @param {string} correctionId - Correction ID
   * @returns {number} Practice count
   */
  getPracticeCount(correctionId) {
    const correction = this.corrections.get(correctionId);
    return correction ? correction.practiceCount : 0;
  }

  /**
   * Show toast notification
   * @param {string} message - Message text
   * @param {string} type - Notification type (error, success, info)
   * @param {number} duration - Duration in ms
   */
  showNotification(message, type = 'info', _duration = 3000) {
    // Implementation depends on existing toast system
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get correction statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const stats = {
      totalCorrections: this.corrections.size,
      severityBreakdown: { high: 0, medium: 0, low: 0 },
      totalPractice: 0,
      averagePractice: 0,
    };

    for (const correction of this.corrections.values()) {
      stats.severityBreakdown[correction.severity]++;
      stats.totalPractice += correction.practiceCount;
    }

    stats.averagePractice =
      stats.totalCorrections > 0 ? stats.totalPractice / stats.totalCorrections : 0;

    return stats;
  }

  /**
   * Export correction history
   * @returns {Array} Correction history
   */
  exportHistory() {
    return {
      corrections: Array.from(this.corrections.entries()),
      history: this.correctionHistory,
      statistics: this.getStatistics(),
    };
  }
}

// Create global instance only in browser environment
if (typeof window !== 'undefined' && !globalThis.process?.env?.NODE_ENV?.includes('test')) {
  window.enhancedCorrections = new EnhancedCorrectionsSystem();
}
