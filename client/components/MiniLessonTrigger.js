/**
 * Mini-Lesson Trigger Component for Bulgarian Voice Coach
 *
 * Manages automatic triggering of mini-lessons based on user errors.
 * Features:
 * - Error pattern tracking
 * - Smart lesson suggestions
 * - Non-intrusive notifications
 * - Integration with speech recognition errors
 */

import MiniLessonService from '../services/MiniLessonService.js';
import MiniLessonModal from './MiniLessonModal.js';

class MiniLessonTrigger {
  constructor(options = {}) {
    this.miniLessonService = new MiniLessonService();
    this.modal = new MiniLessonModal();

    this.errorHistory = [];
    this.maxErrorHistory = 100;
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.lastCheck = 0;

    // Configuration
    this.config = {
      enableAutoTrigger: options.enableAutoTrigger !== false,
      enableNotifications: options.enableNotifications !== false,
      minErrorsForSuggestion: options.minErrorsForSuggestion || 2,
      suggestionCooldown: options.suggestionCooldown || 300000, // 5 minutes
      maxSuggestionsPerHour: options.maxSuggestionsPerHour || 3,
    };

    this.recentSuggestions = [];
    this.createNotificationElement();

    // Start periodic checks
    if (this.config.enableAutoTrigger) {
      this.startPeriodicChecks();
    }
  }

  /**
   * Create notification element
   */
  createNotificationElement() {
    this.notification = document.createElement('div');
    this.notification.className = 'mini-lesson-notification';
    this.notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">💡</div>
        <div class="notification-message">
          <div class="notification-title">Препоръка за урок</div>
          <div class="notification-text"></div>
        </div>
        <div class="notification-actions">
          <button class="notification-btn notification-accept">Започни</button>
          <button class="notification-btn notification-dismiss">По-късно</button>
        </div>
      </div>
      <button class="notification-close">×</button>
    `;

    document.body.appendChild(this.notification);
    this.addNotificationStyles();
    this.bindNotificationEvents();
  }

  /**
   * Add notification styles
   */
  addNotificationStyles() {
    if (document.getElementById('mini-lesson-notification-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'mini-lesson-notification-styles';
    styles.textContent = `
      .mini-lesson-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        background: var(--bg-primary, #ffffff);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        transform: translateX(120%);
        transition: transform 0.3s ease-out;
        font-family: 'Ysabeau', system-ui, -apple-system, sans-serif;
      }

      .mini-lesson-notification.visible {
        transform: translateX(0);
      }

      .notification-content {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem;
      }

      .notification-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
        margin-top: 0.25rem;
      }

      .notification-message {
        flex: 1;
        min-width: 0;
      }

      .notification-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary, #111827);
        margin-bottom: 0.25rem;
      }

      .notification-text {
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        line-height: 1.4;
        margin-bottom: 1rem;
      }

      .notification-actions {
        display: flex;
        gap: 0.5rem;
      }

      .notification-btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .notification-accept {
        background: var(--accent-primary, #3b82f6);
        color: white;
      }

      .notification-accept:hover {
        background: var(--accent-primary-hover, #2563eb);
      }

      .notification-dismiss {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-secondary, #6b7280);
      }

      .notification-dismiss:hover {
        background: var(--bg-hover, #e5e7eb);
        color: var(--text-primary, #111827);
      }

      .notification-close {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: none;
        border: none;
        font-size: 1.25rem;
        color: var(--text-secondary, #6b7280);
        cursor: pointer;
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .notification-close:hover {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-primary, #111827);
      }

      @media (max-width: 640px) {
        .mini-lesson-notification {
          left: 10px;
          right: 10px;
          top: 10px;
          max-width: none;
        }

        .notification-actions {
          flex-direction: column;
        }

        .notification-btn {
          width: 100%;
        }
      }

      @keyframes notificationPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .mini-lesson-notification.pulse {
        animation: notificationPulse 2s infinite;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Bind notification event handlers
   */
  bindNotificationEvents() {
    this.notification.querySelector('.notification-accept').addEventListener('click', () => {
      this.acceptSuggestion();
    });

    this.notification.querySelector('.notification-dismiss').addEventListener('click', () => {
      this.dismissSuggestion();
    });

    this.notification.querySelector('.notification-close').addEventListener('click', () => {
      this.dismissSuggestion();
    });
  }

  /**
   * Record a grammar error
   * @param {string} errorPattern - Error pattern identifier
   * @param {string} userText - User's original text
   * @param {string} correctedText - Corrected text
   * @param {number} confidence - Confidence score (0-1)
   * @param {object} context - Additional context
   */
  recordError(errorPattern, userText, correctedText, confidence = 1, context = {}) {
    const errorData = {
      pattern: errorPattern,
      userText,
      correctedText,
      confidence,
      context,
      timestamp: new Date().toISOString(),
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.errorHistory.push(errorData);

    // Keep history size manageable
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }

    console.log('Error recorded:', errorData);

    // Immediate check for suggestions
    this.checkForSuggestions();
  }

  /**
   * Start periodic checks for lesson suggestions
   */
  startPeriodicChecks() {
    setInterval(() => {
      this.checkForSuggestions();
    }, this.checkInterval);
  }

  /**
   * Check if any lessons should be suggested
   */
  async checkForSuggestions() {
    if (!this.config.enableAutoTrigger) return;

    const now = Date.now();

    // Throttle checks
    if (now - this.lastCheck < 10000) return; // Minimum 10 seconds between checks
    this.lastCheck = now;

    // Check rate limiting
    if (!this.canSuggestLesson()) return;

    try {
      // Get recent errors (last 24 hours)
      const recentErrors = this.getRecentErrors(24 * 60 * 60 * 1000);
      if (recentErrors.length < this.config.minErrorsForSuggestion) return;

      // Group errors by pattern
      const errorGroups = this.groupErrorsByPattern(recentErrors);

      // Find the most frequent error pattern
      let bestPattern = null;
      let maxCount = 0;

      for (const [pattern, errors] of Object.entries(errorGroups)) {
        if (errors.length > maxCount) {
          maxCount = errors.length;
          bestPattern = pattern;
        }
      }

      if (!bestPattern || maxCount < this.config.minErrorsForSuggestion) return;

      // Get lessons for this error pattern
      const suggestedLessons = await this.miniLessonService.getLessonsForError(bestPattern);
      if (suggestedLessons.length === 0) return;

      // Check if any of these lessons should be triggered
      for (const lesson of suggestedLessons) {
        const shouldTrigger = await this.miniLessonService.shouldTriggerLesson(
          recentErrors,
          lesson.id
        );

        if (shouldTrigger) {
          this.suggestLesson(lesson, bestPattern, errorGroups[bestPattern]);
          break;
        }
      }
    } catch (error) {
      console.error('Error checking for suggestions:', error);
    }
  }

  /**
   * Get recent errors within time window
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Array} Array of recent errors
   */
  getRecentErrors(timeWindowMs) {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.errorHistory.filter((error) => new Date(error.timestamp) > cutoff);
  }

  /**
   * Group errors by pattern
   * @param {Array} errors - Array of error objects
   * @returns {object} Object mapping patterns to error arrays
   */
  groupErrorsByPattern(errors) {
    const groups = {};

    for (const error of errors) {
      if (!groups[error.pattern]) {
        groups[error.pattern] = [];
      }
      groups[error.pattern].push(error);
    }

    return groups;
  }

  /**
   * Check if we can suggest a lesson (rate limiting)
   * @returns {boolean} Whether suggestion is allowed
   */
  canSuggestLesson() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    // Clean old suggestions
    this.recentSuggestions = this.recentSuggestions.filter(
      (suggestion) => suggestion.timestamp > hourAgo
    );

    // Check hourly limit
    if (this.recentSuggestions.length >= this.config.maxSuggestionsPerHour) {
      return false;
    }

    // Check cooldown
    const lastSuggestion = this.recentSuggestions[this.recentSuggestions.length - 1];
    if (lastSuggestion && now - lastSuggestion.timestamp < this.config.suggestionCooldown) {
      return false;
    }

    return true;
  }

  /**
   * Suggest a mini-lesson to the user
   * @param {object} lesson - Lesson object
   * @param {string} errorPattern - Triggering error pattern
   * @param {Array} relatedErrors - Related errors
   */
  suggestLesson(lesson, errorPattern, relatedErrors) {
    if (!this.config.enableNotifications) return;

    this.currentSuggestion = {
      lesson,
      errorPattern,
      relatedErrors,
      timestamp: Date.now(),
    };

    // Record suggestion for rate limiting
    this.recentSuggestions.push({
      lessonId: lesson.id,
      timestamp: Date.now(),
    });

    // Show notification
    const notificationText = this.notification.querySelector('.notification-text');
    notificationText.textContent = this.generateSuggestionMessage(lesson, relatedErrors);

    this.notification.classList.add('visible');

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (this.notification.classList.contains('visible')) {
        this.dismissSuggestion();
      }
    }, 15000);

    console.log('Suggested lesson:', lesson.id, 'for pattern:', errorPattern);
  }

  /**
   * Generate suggestion message
   * @param {object} lesson - Lesson object
   * @param {Array} errors - Related errors
   * @returns {string} Suggestion message
   */
  generateSuggestionMessage(lesson, errors) {
    const errorCount = errors.length;
    const lessonTitle = lesson.title_bg || lesson.title_en || lesson.id;

    return `Забелязах ${errorCount} грешки от този тип. Кратък урок "${lessonTitle}" може да помогне (${lesson.duration_minutes || 2} мин).`;
  }

  /**
   * Accept the lesson suggestion
   */
  acceptSuggestion() {
    if (!this.currentSuggestion) return;

    this.hideNotification();

    // Show the lesson modal
    this.modal.show(this.currentSuggestion.lesson, (lessonId, completionData) => {
      this.miniLessonService.updateLessonProgress(lessonId, completionData);
      console.log('Mini-lesson completed:', lessonId, completionData);
    });

    this.currentSuggestion = null;
  }

  /**
   * Dismiss the lesson suggestion
   */
  dismissSuggestion() {
    this.hideNotification();
    this.currentSuggestion = null;
  }

  /**
   * Hide the notification
   */
  hideNotification() {
    this.notification.classList.remove('visible', 'pulse');
  }

  /**
   * Manually check for due lessons
   * @returns {Promise<Array>} Array of due lessons
   */
  async checkDueLessons() {
    try {
      return await this.miniLessonService.getDueMiniLessons(3);
    } catch (error) {
      console.error('Error checking due lessons:', error);
      return [];
    }
  }

  /**
   * Manually suggest a lesson
   * @param {string} lessonId - Lesson ID to suggest
   */
  async suggestSpecificLesson(lessonId) {
    try {
      const lesson = await this.miniLessonService.getMiniLesson(lessonId);
      if (lesson) {
        this.suggestLesson(lesson, 'manual', []);
      }
    } catch (error) {
      console.error('Error suggesting specific lesson:', error);
    }
  }

  /**
   * Get error statistics
   * @returns {object} Error statistics
   */
  getErrorStatistics() {
    const recentErrors = this.getRecentErrors(24 * 60 * 60 * 1000);
    const errorGroups = this.groupErrorsByPattern(recentErrors);

    const stats = {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      patterns: Object.keys(errorGroups).length,
      mostCommonPattern: null,
      mostCommonCount: 0,
    };

    // Find most common pattern
    for (const [pattern, errors] of Object.entries(errorGroups)) {
      if (errors.length > stats.mostCommonCount) {
        stats.mostCommonPattern = pattern;
        stats.mostCommonCount = errors.length;
      }
    }

    return stats;
  }

  /**
   * Configure trigger settings
   * @param {object} newConfig - New configuration
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.recentSuggestions = [];
  }

  /**
   * Export error data for analysis
   * @returns {object} Error data export
   */
  exportErrorData() {
    return {
      errorHistory: this.errorHistory,
      recentSuggestions: this.recentSuggestions,
      statistics: this.getErrorStatistics(),
      exportDate: new Date().toISOString(),
    };
  }
}

// Export for use in main application
export default MiniLessonTrigger;
