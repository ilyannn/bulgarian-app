/**
 * @fileoverview Tests for LocalProgressService
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalProgressService from '../services/LocalProgressService.js';

describe('LocalProgressService', () => {
  let service;
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      store: {},
      getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
      setItem: vi.fn((key, value) => {
        mockLocalStorage.store[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockLocalStorage.store[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage.store = {};
      }),
    };

    global.localStorage = mockLocalStorage;

    service = new LocalProgressService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe('Initialization', () => {
    it('should initialize storage with default data structure', () => {
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      const storedData = JSON.parse(mockLocalStorage.store.bulgarian_coach_progress);
      expect(storedData).toHaveProperty('version', '1.0');
      expect(storedData).toHaveProperty('userId');
      expect(storedData).toHaveProperty('progress');
      expect(storedData).toHaveProperty('drillResults');
      expect(storedData).toHaveProperty('statistics');
      expect(storedData).toHaveProperty('lastUpdated');
    });

    it('should initialize settings with defaults', () => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bulgarian_coach_settings',
        expect.any(String)
      );

      const storedSettings = JSON.parse(mockLocalStorage.store.bulgarian_coach_settings);
      expect(storedSettings).toHaveProperty('targetAccuracy', 0.85);
      expect(storedSettings).toHaveProperty('minReviewsForMastery', 3);
      expect(storedSettings).toHaveProperty('maxDailyItems', 20);
      expect(storedSettings).toHaveProperty('l1Language', 'PL');
    });

    it('should not reinitialize if data already exists', () => {
      const existingData = {
        version: '1.0',
        userId: 'existing_user',
        progress: { 'test.grammar': { totalAttempts: 5 } },
        drillResults: [],
        statistics: {},
        lastUpdated: new Date().toISOString(),
      };

      mockLocalStorage.store.bulgarian_coach_progress = JSON.stringify(existingData);
      mockLocalStorage.setItem.mockClear();

      new LocalProgressService();

      // Should not call setItem again
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'bulgarian_coach_progress',
        expect.any(String)
      );
    });
  });

  describe('User ID Generation', () => {
    it('should generate valid user ID format', () => {
      const userId = service.generateUserId();
      expect(userId).toMatch(/^user_[a-z0-9]{7}$/);
    });

    it('should generate unique user IDs', () => {
      const id1 = service.generateUserId();
      const id2 = service.generateUserId();
      expect(id1).not.toBe(id2);
    });

    it('should retrieve existing user ID from storage', () => {
      const userId = service.getUserId();
      expect(userId).toMatch(/^user_[a-z0-9]{7}$/);

      // Should return same ID on subsequent calls
      const userId2 = service.getUserId();
      expect(userId2).toBe(userId);
    });
  });

  describe('Drill Result Updates', () => {
    it('should create new progress entry for first attempt', () => {
      const drillResult = {
        grammarId: 'bg.test.grammar',
        drillType: 'transform',
        userAnswer: 'correct answer',
        correctAnswer: 'correct answer',
        isCorrect: true,
        responseTimeMs: 2000,
        hintUsed: false,
      };

      service.updateDrillResult(drillResult);

      const progress = service.getUserProgress('bg.test.grammar');
      expect(progress).not.toBeNull();
      expect(progress.grammarId).toBe('bg.test.grammar');
      expect(progress.masteryLevel).toBe(0);
      expect(progress.totalAttempts).toBe(1);
      expect(progress.correctAttempts).toBe(1);
      expect(progress.consecutiveCorrect).toBe(1);
      expect(progress.averageResponseTime).toBe(2000);
    });

    it('should update existing progress entry', () => {
      const grammarId = 'bg.test.grammar';

      // First attempt - correct
      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
        responseTimeMs: 2000,
      });

      // Second attempt - incorrect
      service.updateDrillResult({
        grammarId,
        drillType: 'fill',
        userAnswer: 'wrong',
        correctAnswer: 'correct',
        isCorrect: false,
        responseTimeMs: 3000,
      });

      const progress = service.getUserProgress(grammarId);
      expect(progress.totalAttempts).toBe(2);
      expect(progress.correctAttempts).toBe(1);
      expect(progress.consecutiveCorrect).toBe(0);
      expect(progress.consecutiveIncorrect).toBe(1);
      expect(progress.averageResponseTime).toBe(2200); // Weighted average
    });

    it('should increase mastery level on consistent correct answers', () => {
      const grammarId = 'bg.test.grammar';

      // Submit 3 correct answers in a row
      for (let i = 0; i < 3; i++) {
        service.updateDrillResult({
          grammarId,
          drillType: 'transform',
          userAnswer: 'correct',
          correctAnswer: 'correct',
          isCorrect: true,
        });
      }

      const progress = service.getUserProgress(grammarId);
      expect(progress.masteryLevel).toBe(1); // Should increase from 0 to 1
    });

    it('should decrease mastery level on poor performance', () => {
      const grammarId = 'bg.test.grammar';

      // Start with some mastery level
      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      // Force mastery level up
      const data = service.getStoredData();
      data.progress[grammarId].masteryLevel = 2;
      service.saveData(data);

      // Submit multiple incorrect answers
      for (let i = 0; i < 3; i++) {
        service.updateDrillResult({
          grammarId,
          drillType: 'transform',
          userAnswer: 'wrong',
          correctAnswer: 'correct',
          isCorrect: false,
        });
      }

      const progress = service.getUserProgress(grammarId);
      expect(progress.masteryLevel).toBeLessThan(2);
    });

    it('should calculate next due date based on SRS intervals', () => {
      const grammarId = 'bg.test.grammar';

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      const progress = service.getUserProgress(grammarId);
      const nextDueDate = new Date(progress.nextDueDate);
      const expectedDueDate = new Date();
      expectedDueDate.setDate(expectedDueDate.getDate() + 1); // Level 0 = 1 day

      // Allow for small time differences
      const timeDifference = Math.abs(nextDueDate.getTime() - expectedDueDate.getTime());
      expect(timeDifference).toBeLessThan(60000); // Within 1 minute
    });

    it('should track hint usage', () => {
      const grammarId = 'bg.test.grammar';

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
        hintUsed: true,
      });

      const progress = service.getUserProgress(grammarId);
      expect(progress.totalHintsUsed).toBe(1);
    });

    it('should store drill results in history', () => {
      const drillResult = {
        grammarId: 'bg.test.grammar',
        drillType: 'transform',
        userAnswer: 'test answer',
        correctAnswer: 'correct answer',
        isCorrect: true,
        responseTimeMs: 1500,
      };

      service.updateDrillResult(drillResult);

      const data = service.getStoredData();
      expect(data.drillResults).toHaveLength(1);
      expect(data.drillResults[0]).toMatchObject({
        grammarId: 'bg.test.grammar',
        drillType: 'transform',
        userAnswer: 'test answer',
        correctAnswer: 'correct answer',
        isCorrect: true,
        responseTimeMs: 1500,
      });
      expect(data.drillResults[0]).toHaveProperty('id');
      expect(data.drillResults[0]).toHaveProperty('timestamp');
    });
  });

  describe('Due Items Calculation', () => {
    beforeEach(() => {
      // Mock Date.now for consistent testing
      vi.spyOn(Date, 'now').mockImplementation(() => new Date('2024-01-15T12:00:00Z').getTime());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return empty array when no items are due', () => {
      const grammarId = 'bg.test.grammar';

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      const dueItems = service.getDueItems();
      expect(dueItems).toEqual([]);
    });

    it('should return due items in priority order', () => {
      const grammarId1 = 'bg.grammar.1';
      const grammarId2 = 'bg.grammar.2';

      // Create two items with different overdue amounts
      service.updateDrillResult({
        grammarId: grammarId1,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      service.updateDrillResult({
        grammarId: grammarId2,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      // Manually set due dates to be overdue
      const data = service.getStoredData();
      data.progress[grammarId1].nextDueDate = '2024-01-10T12:00:00Z'; // 5 days overdue
      data.progress[grammarId2].nextDueDate = '2024-01-12T12:00:00Z'; // 3 days overdue
      service.saveData(data);

      const dueItems = service.getDueItems();
      expect(dueItems).toEqual([grammarId1, grammarId2]); // Most overdue first
    });

    it('should limit returned items to specified limit', () => {
      const grammarIds = ['bg.grammar.1', 'bg.grammar.2', 'bg.grammar.3'];

      for (const grammarId of grammarIds) {
        service.updateDrillResult({
          grammarId,
          drillType: 'transform',
          userAnswer: 'correct',
          correctAnswer: 'correct',
          isCorrect: true,
        });
      }

      // Set all as overdue
      const data = service.getStoredData();
      for (const grammarId of grammarIds) {
        data.progress[grammarId].nextDueDate = '2024-01-10T12:00:00Z';
      }
      service.saveData(data);

      const dueItems = service.getDueItems(2);
      expect(dueItems).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should return empty statistics for new user', () => {
      const stats = service.getUserStatistics();

      expect(stats.totalItemsPracticed).toBe(0);
      expect(stats.totalAttempts).toBe(0);
      expect(stats.overallAccuracy).toBe(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.masteredItems).toBe(0);
    });

    it('should calculate accurate statistics from progress data', () => {
      const grammarIds = ['bg.grammar.1', 'bg.grammar.2'];

      // Add some practice data
      for (const grammarId of grammarIds) {
        // 2 correct, 1 incorrect per grammar item
        for (let i = 0; i < 2; i++) {
          service.updateDrillResult({
            grammarId,
            drillType: 'transform',
            userAnswer: 'correct',
            correctAnswer: 'correct',
            isCorrect: true,
          });
        }

        service.updateDrillResult({
          grammarId,
          drillType: 'transform',
          userAnswer: 'wrong',
          correctAnswer: 'correct',
          isCorrect: false,
        });
      }

      const stats = service.getUserStatistics();

      expect(stats.totalItemsPracticed).toBe(2);
      expect(stats.totalAttempts).toBe(6); // 3 attempts per item × 2 items
      expect(stats.totalCorrectAnswers).toBe(4);
      expect(stats.overallAccuracy).toBe(0.67); // 4/6 rounded
      expect(stats.currentStreak).toBe(0); // Ended with incorrect answer
    });

    it('should calculate current streak correctly', () => {
      const grammarId = 'bg.test.grammar';

      // Submit sequence: correct, correct, incorrect, correct, correct
      const sequence = [true, true, false, true, true];

      for (const isCorrect of sequence) {
        service.updateDrillResult({
          grammarId,
          drillType: 'transform',
          userAnswer: isCorrect ? 'correct' : 'wrong',
          correctAnswer: 'correct',
          isCorrect,
        });
      }

      const stats = service.getUserStatistics();
      expect(stats.currentStreak).toBe(2); // Last 2 were correct
      expect(stats.longestStreak).toBe(2); // Longest streak in sequence
    });

    it('should count mastered items correctly', () => {
      const grammarId = 'bg.test.grammar';

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      // Manually set high mastery level
      const data = service.getStoredData();
      data.progress[grammarId].masteryLevel = 4; // Mastered (≥4)
      service.saveData(data);

      const stats = service.getUserStatistics();
      expect(stats.masteredItems).toBe(1);
    });
  });

  describe('Warm-up Items', () => {
    it('should return foundational items for new users', () => {
      const warmupItems = service.getWarmupItems(3);

      expect(warmupItems).toEqual([
        'bg.no_infinitive.da_present',
        'bg.definite.article.postposed',
        'bg.future.shte',
      ]);
    });

    it('should return due items for existing users', () => {
      const grammarId = 'bg.test.grammar';

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      // Set as overdue
      const data = service.getStoredData();
      data.progress[grammarId].nextDueDate = '2020-01-01T00:00:00Z';
      service.saveData(data);

      const warmupItems = service.getWarmupItems(3);
      expect(warmupItems).toContain(grammarId);
    });

    it('should limit warmup items to requested count', () => {
      const warmupItems = service.getWarmupItems(2);
      expect(warmupItems).toHaveLength(2);
    });
  });

  describe('Data Export/Import', () => {
    it('should export complete data structure', () => {
      const grammarId = 'bg.test.grammar';

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      const exportData = service.exportData();

      expect(exportData).toHaveProperty('progress');
      expect(exportData).toHaveProperty('settings');
      expect(exportData).toHaveProperty('exportDate');
      expect(exportData).toHaveProperty('version');
      expect(exportData.progress.progress[grammarId]).toBeDefined();
    });

    it('should import data successfully', () => {
      const importData = {
        progress: {
          version: '1.0',
          userId: 'imported_user',
          progress: {
            'bg.imported.grammar': {
              grammarId: 'bg.imported.grammar',
              masteryLevel: 2,
              totalAttempts: 5,
              correctAttempts: 4,
            },
          },
          drillResults: [],
          statistics: {},
          lastUpdated: new Date().toISOString(),
        },
        settings: {
          targetAccuracy: 0.9,
          l1Language: 'RU',
        },
      };

      const success = service.importData(importData);
      expect(success).toBe(true);

      const progress = service.getUserProgress('bg.imported.grammar');
      expect(progress).not.toBeNull();
      expect(progress.masteryLevel).toBe(2);

      const settings = service.getSettings();
      expect(settings.targetAccuracy).toBe(0.9);
      expect(settings.l1Language).toBe('RU');
    });

    it('should handle invalid import data', () => {
      const invalidData = { invalid: 'data' };

      const success = service.importData(invalidData);
      expect(success).toBe(false);
    });
  });

  describe('Progress Reset', () => {
    it('should reset progress data while keeping settings', () => {
      const grammarId = 'bg.test.grammar';

      // Add some progress
      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      // Modify settings
      const settings = service.getSettings();
      settings.targetAccuracy = 0.95;
      service.saveSettings(settings);

      // Reset progress
      service.resetProgress();

      // Progress should be cleared
      const progress = service.getUserProgress(grammarId);
      expect(progress).toBeNull();

      // Settings should be preserved
      const currentSettings = service.getSettings();
      expect(currentSettings.targetAccuracy).toBe(0.95);

      // Should have new user ID
      const userId = service.getUserId();
      expect(userId).toMatch(/^user_[a-z0-9]{7}$/);
    });
  });

  describe('Utility Methods', () => {
    it('should check if grammar item has been practiced', () => {
      const grammarId = 'bg.test.grammar';

      expect(service.hasBeenPracticed(grammarId)).toBe(false);

      service.updateDrillResult({
        grammarId,
        drillType: 'transform',
        userAnswer: 'correct',
        correctAnswer: 'correct',
        isCorrect: true,
      });

      expect(service.hasBeenPracticed(grammarId)).toBe(true);
    });

    it('should return foundational grammar items', () => {
      const foundationalItems = service.getFoundationalItems();

      expect(foundationalItems).toEqual([
        'bg.no_infinitive.da_present',
        'bg.definite.article.postposed',
        'bg.future.shte',
      ]);
    });

    it('should limit foundational items to requested count', () => {
      const foundationalItems = service.getFoundationalItems(2);
      expect(foundationalItems).toHaveLength(2);
      expect(foundationalItems).toEqual([
        'bg.no_infinitive.da_present',
        'bg.definite.article.postposed',
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const data = service.getStoredData();
      expect(data).toBeNull();
    });

    it('should handle corrupted data in localStorage', () => {
      mockLocalStorage.store.bulgarian_coach_progress = 'invalid json';

      const data = service.getStoredData();
      expect(data).toBeNull();
    });

    it('should throw error when updating drill result without data', () => {
      // Clear localStorage
      mockLocalStorage.clear();

      expect(() => {
        service.updateDrillResult({
          grammarId: 'bg.test',
          drillType: 'transform',
          userAnswer: 'test',
          correctAnswer: 'test',
          isCorrect: true,
        });
      }).toThrow('No progress data found');
    });
  });
});
