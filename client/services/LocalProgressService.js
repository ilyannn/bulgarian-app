/**
 * Local Progress Service for Bulgarian Voice Coach
 *
 * Implements Spaced Repetition System (SRS) for grammar item progress tracking
 * using localStorage for persistent storage without requiring authentication.
 *
 * Features:
 * - SRS algorithm with 6 mastery levels
 * - Drill result tracking with timestamps
 * - Due items calculation based on review dates
 * - Statistics aggregation (accuracy, streaks, response times)
 * - Data export/import functionality
 * - Privacy-first design (data never leaves device)
 */

class LocalProgressService {
  constructor() {
    this.storageKey = 'bulgarian_coach_progress';
    this.settingsKey = 'bulgarian_coach_settings';

    // SRS intervals in days for each mastery level (0-5)
    this.srsIntervals = [1, 3, 7, 21, 60, 120];

    // Initialize storage if not exists
    this.initializeStorage();
  }

  /**
   * Initialize localStorage with default structure
   */
  initializeStorage() {
    if (!this.getStoredData()) {
      const defaultData = {
        version: '1.0',
        userId: this.generateUserId(),
        progress: {}, // grammarId -> progress object
        drillResults: [], // array of drill result objects
        statistics: this.getEmptyStatistics(),
        lastUpdated: new Date().toISOString(),
      };
      this.saveData(defaultData);
    }

    if (!this.getSettings()) {
      const defaultSettings = {
        targetAccuracy: 0.85,
        minReviewsForMastery: 3,
        maxDailyItems: 20,
        enableNotifications: false,
        l1Language: 'PL', // Polish, Russian, Ukrainian, Serbian
      };
      this.saveSettings(defaultSettings);
    }
  }

  /**
   * Generate a unique user ID for local storage
   * @returns {string} User ID in format 'user_xxxxxxx'
   */
  generateUserId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'user_';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get stored progress data
   * @returns {object|null} Progress data or null if not found
   */
  getStoredData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to parse stored progress data:', error);
      return null;
    }
  }

  /**
   * Save progress data to localStorage
   * @param {object} data - Progress data to save
   */
  saveData(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save progress data:', error);
      throw new Error('Failed to save progress data');
    }
  }

  /**
   * Get user settings
   * @returns {object|null} Settings object or null
   */
  getSettings() {
    try {
      const settings = localStorage.getItem(this.settingsKey);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Failed to parse settings:', error);
      return null;
    }
  }

  /**
   * Save user settings
   * @param {object} settings - Settings to save
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Get user ID from storage
   * @returns {string} User ID
   */
  getUserId() {
    const data = this.getStoredData();
    return data ? data.userId : this.generateUserId();
  }

  /**
   * Update drill result and progress
   * @param {object} drillResult - Drill result object
   * @param {string} drillResult.grammarId - Grammar item ID
   * @param {string} drillResult.drillType - Type of drill
   * @param {string} drillResult.userAnswer - User's answer
   * @param {string} drillResult.correctAnswer - Expected answer
   * @param {boolean} drillResult.isCorrect - Whether answer was correct
   * @param {number} drillResult.responseTimeMs - Response time in milliseconds
   * @param {boolean} drillResult.hintUsed - Whether hint was used
   */
  updateDrillResult({
    grammarId,
    drillType,
    userAnswer,
    correctAnswer,
    isCorrect,
    responseTimeMs = null,
    hintUsed = false,
  }) {
    const data = this.getStoredData();
    if (!data) throw new Error('No progress data found');

    // Add drill result
    const drillResult = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      grammarId,
      drillType,
      userAnswer,
      correctAnswer,
      isCorrect,
      responseTimeMs,
      hintUsed,
      timestamp: new Date().toISOString(),
    };
    data.drillResults.push(drillResult);

    // Update progress for this grammar item
    if (!data.progress[grammarId]) {
      data.progress[grammarId] = {
        grammarId,
        masteryLevel: 0,
        totalAttempts: 0,
        correctAttempts: 0,
        averageResponseTime: 0,
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
        lastReviewDate: null,
        nextDueDate: null,
        firstSeenDate: new Date().toISOString(),
        totalHintsUsed: 0,
      };
    }

    const progress = data.progress[grammarId];
    progress.totalAttempts++;
    progress.lastReviewDate = new Date().toISOString();

    if (hintUsed) {
      progress.totalHintsUsed++;
    }

    // Update response time (rolling average)
    if (responseTimeMs) {
      if (progress.averageResponseTime === 0) {
        progress.averageResponseTime = responseTimeMs;
      } else {
        progress.averageResponseTime = Math.round(
          progress.averageResponseTime * 0.8 + responseTimeMs * 0.2
        );
      }
    }

    if (isCorrect) {
      progress.correctAttempts++;
      progress.consecutiveCorrect++;
      progress.consecutiveIncorrect = 0;

      // Check for mastery level increase
      const settings = this.getSettings();
      const accuracy = progress.correctAttempts / progress.totalAttempts;
      const minReviews = settings?.minReviewsForMastery || 3;

      if (
        progress.totalAttempts >= minReviews &&
        progress.consecutiveCorrect >= 2 &&
        accuracy >= (settings?.targetAccuracy || 0.85)
      ) {
        progress.masteryLevel = Math.min(5, progress.masteryLevel + 1);
        progress.consecutiveCorrect = 0; // Reset counter after level up
      }
    } else {
      progress.consecutiveIncorrect++;
      progress.consecutiveCorrect = 0;

      // Check for mastery level decrease (if accuracy drops significantly)
      const accuracy = progress.correctAttempts / progress.totalAttempts;
      if (progress.consecutiveIncorrect >= 2 && accuracy < 0.6) {
        progress.masteryLevel = Math.max(0, progress.masteryLevel - 1);
      }
    }

    // Calculate next due date based on SRS
    const intervalDays = this.srsIntervals[progress.masteryLevel];
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + intervalDays);
    progress.nextDueDate = nextDue.toISOString();

    // Update statistics
    this.updateStatistics(data);

    this.saveData(data);
  }

  /**
   * Get due grammar items for practice
   * @param {number} limit - Maximum number of items to return
   * @returns {Array<string>} Array of grammar IDs due for practice
   */
  getDueItems(limit = 10) {
    const data = this.getStoredData();
    if (!data) return [];

    const now = new Date();
    const dueItems = [];

    // Get items that are due for review
    for (const [grammarId, progress] of Object.entries(data.progress)) {
      if (!progress.nextDueDate) continue;

      const dueDate = new Date(progress.nextDueDate);
      if (dueDate <= now) {
        dueItems.push({
          grammarId,
          priority: this.calculatePriority(progress, now),
        });
      }
    }

    // Sort by priority and return IDs
    return dueItems
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map((item) => item.grammarId);
  }

  /**
   * Calculate priority for due items
   * @param {object} progress - Progress object
   * @param {Date} now - Current date
   * @returns {number} Priority score
   */
  calculatePriority(progress, now) {
    let priority = 0;

    // Higher priority for overdue items
    const dueDate = new Date(progress.nextDueDate);
    const overdueDays = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
    priority += overdueDays * 10;

    // Higher priority for lower mastery levels
    priority += (5 - progress.masteryLevel) * 5;

    // Higher priority for items with recent incorrect answers
    priority += progress.consecutiveIncorrect * 3;

    // Lower priority for items with high accuracy
    const accuracy = progress.correctAttempts / Math.max(1, progress.totalAttempts);
    priority -= accuracy * 5;

    return priority;
  }

  /**
   * Get user progress for specific grammar item
   * @param {string} grammarId - Grammar item ID
   * @returns {object|null} Progress object or null
   */
  getUserProgress(grammarId) {
    const data = this.getStoredData();
    if (!data) return null;

    return data.progress[grammarId] || null;
  }

  /**
   * Get comprehensive user statistics
   * @returns {object} Statistics object
   */
  getUserStatistics() {
    const data = this.getStoredData();
    if (!data) return this.getEmptyStatistics();

    this.updateStatistics(data);
    return data.statistics;
  }

  /**
   * Update statistics based on current data
   * @param {object} data - Progress data
   */
  updateStatistics(data) {
    const stats = {
      totalItemsPracticed: Object.keys(data.progress).length,
      totalAttempts: 0,
      totalCorrectAnswers: 0,
      overallAccuracy: 0,
      averageMasteryLevel: 0,
      masteredItems: 0,
      itemsNeedingAttention: 0,
      averageResponseTime: 0,
      totalHintsUsed: 0,
      currentStreak: 0,
      longestStreak: 0,
      practiceSessionsThisWeek: 0,
      lastPracticeDate: null,
    };

    // Calculate from progress data
    for (const progress of Object.values(data.progress)) {
      stats.totalAttempts += progress.totalAttempts;
      stats.totalCorrectAnswers += progress.correctAttempts;
      stats.averageMasteryLevel += progress.masteryLevel;
      stats.totalHintsUsed += progress.totalHintsUsed;

      if (progress.masteryLevel >= 4) {
        stats.masteredItems++;
      }

      if (progress.masteryLevel <= 1 && progress.totalAttempts > 0) {
        stats.itemsNeedingAttention++;
      }

      if (
        progress.lastReviewDate &&
        (!stats.lastPracticeDate || progress.lastReviewDate > stats.lastPracticeDate)
      ) {
        stats.lastPracticeDate = progress.lastReviewDate;
      }
    }

    if (stats.totalItemsPracticed > 0) {
      stats.averageMasteryLevel =
        Math.round((stats.averageMasteryLevel / stats.totalItemsPracticed) * 100) / 100;
    }

    if (stats.totalAttempts > 0) {
      stats.overallAccuracy =
        Math.round((stats.totalCorrectAnswers / stats.totalAttempts) * 100) / 100;
    }

    // Calculate streaks and recent activity
    this.calculateStreaksAndActivity(data, stats);

    data.statistics = stats;
  }

  /**
   * Calculate streaks and recent activity
   * @param {object} data - Progress data
   * @param {object} stats - Statistics object to update
   */
  calculateStreaksAndActivity(data, stats) {
    const recentResults = data.drillResults
      .filter((result) => {
        const resultDate = new Date(result.timestamp);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return resultDate >= weekAgo;
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Calculate current streak (from end backwards until first incorrect)
    let currentStreak = 0;
    for (let i = data.drillResults.length - 1; i >= 0; i--) {
      if (data.drillResults[i].isCorrect) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    for (const result of data.drillResults) {
      if (result.isCorrect) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    stats.currentStreak = currentStreak;
    stats.longestStreak = longestStreak;

    // Count practice sessions this week
    const sessionsThisWeek = new Set();
    for (const result of recentResults) {
      const dateStr = result.timestamp.split('T')[0];
      sessionsThisWeek.add(dateStr);
    }
    stats.practiceSessionsThisWeek = sessionsThisWeek.size;

    // Calculate average response time from recent results
    const recentResponseTimes = recentResults
      .filter((result) => result.responseTimeMs)
      .map((result) => result.responseTimeMs);

    if (recentResponseTimes.length > 0) {
      stats.averageResponseTime = Math.round(
        recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length
      );
    }
  }

  /**
   * Get empty statistics object
   * @returns {object} Empty statistics
   */
  getEmptyStatistics() {
    return {
      totalItemsPracticed: 0,
      totalAttempts: 0,
      totalCorrectAnswers: 0,
      overallAccuracy: 0,
      averageMasteryLevel: 0,
      masteredItems: 0,
      itemsNeedingAttention: 0,
      averageResponseTime: 0,
      totalHintsUsed: 0,
      currentStreak: 0,
      longestStreak: 0,
      practiceSessionsThisWeek: 0,
      lastPracticeDate: null,
    };
  }

  /**
   * Export all data for backup
   * @returns {object} Complete data export
   */
  exportData() {
    const data = this.getStoredData();
    const settings = this.getSettings();

    return {
      progress: data,
      settings: settings,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
  }

  /**
   * Import data from backup
   * @param {object} importData - Data to import
   * @returns {boolean} Success status
   */
  importData(importData) {
    try {
      if (!importData.progress || !importData.settings) {
        throw new Error('Invalid import data format');
      }

      // Validate data structure
      if (!importData.progress.userId || !importData.progress.progress) {
        throw new Error('Missing required fields in import data');
      }

      // Save imported data
      this.saveData(importData.progress);
      this.saveSettings(importData.settings);

      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  /**
   * Reset all progress data (keep settings)
   */
  resetProgress() {
    const settings = this.getSettings();
    const defaultData = {
      version: '1.0',
      userId: this.generateUserId(),
      progress: {},
      drillResults: [],
      statistics: this.getEmptyStatistics(),
      lastUpdated: new Date().toISOString(),
    };

    this.saveData(defaultData);

    // Restore settings
    if (settings) {
      this.saveSettings(settings);
    }
  }

  /**
   * Get foundational grammar items for new users
   * @param {number} limit - Number of items to return
   * @returns {Array<string>} Array of grammar IDs
   */
  getFoundationalItems(limit = 3) {
    return ['bg.no_infinitive.da_present', 'bg.definite.article.postposed', 'bg.future.shte'].slice(
      0,
      limit
    );
  }

  /**
   * Check if grammar item has been practiced
   * @param {string} grammarId - Grammar item ID
   * @returns {boolean} True if practiced before
   */
  hasBeenPracticed(grammarId) {
    const data = this.getStoredData();
    if (!data || !data.progress || !data.progress[grammarId]) {
      return false;
    }
    return data.progress[grammarId].totalAttempts > 0;
  }

  /**
   * Get items for warm-up based on SRS
   * @param {number} limit - Number of items to return
   * @returns {Array<string>} Array of grammar IDs for warm-up
   */
  getWarmupItems(limit = 3) {
    const dueItems = this.getDueItems(limit * 2);

    if (dueItems.length === 0) {
      // New user - return foundational items
      return this.getFoundationalItems(limit);
    }

    return dueItems.slice(0, limit);
  }
}

// Export for use in main application
export default LocalProgressService;
