/**
 * Mini-Lesson Service for Bulgarian Voice Coach
 *
 * Manages mini-lessons for targeted error correction and remediation.
 * Integrates with LocalProgressService for SRS tracking and due date calculation.
 *
 * Features:
 * - Fetch available mini-lessons from backend
 * - Get lessons due for review based on user progress
 * - Get lessons matching specific error patterns
 * - Track completion and SRS progression
 * - Calculate trigger conditions for lessons
 */

import LocalProgressService from "./LocalProgressService.js";

class MiniLessonService {
	constructor() {
		this.progressService = new LocalProgressService();
		this.baseURL = window.location.origin;
		this.cache = new Map();
		this.cacheTTL = 5 * 60 * 1000; // 5 minutes
	}

	/**
	 * Get all available mini-lessons
	 * @returns {Promise<Array>} Array of mini-lesson objects
	 */
	async getMiniLessons() {
		try {
			const cacheKey = "all_mini_lessons";
			const cached = this.getCachedData(cacheKey);
			if (cached) return cached;

			const response = await fetch(`${this.baseURL}/content/mini-lessons`);
			if (!response.ok) {
				throw new Error(`Failed to fetch mini-lessons: ${response.status}`);
			}

			const lessons = await response.json();
			this.setCachedData(cacheKey, lessons);
			return lessons;
		} catch (error) {
			console.error("Error fetching mini-lessons:", error);
			throw error;
		}
	}

	/**
	 * Get specific mini-lesson by ID
	 * @param {string} lessonId - Mini-lesson ID
	 * @returns {Promise<object|null>} Mini-lesson object or null
	 */
	async getMiniLesson(lessonId) {
		try {
			const cacheKey = `lesson_${lessonId}`;
			const cached = this.getCachedData(cacheKey);
			if (cached) return cached;

			const response = await fetch(
				`${this.baseURL}/content/mini-lessons/${lessonId}`,
			);
			if (!response.ok) {
				if (response.status === 404) return null;
				throw new Error(`Failed to fetch mini-lesson: ${response.status}`);
			}

			const lesson = await response.json();
			this.setCachedData(cacheKey, lesson);
			return lesson;
		} catch (error) {
			console.error("Error fetching mini-lesson:", error);
			throw error;
		}
	}

	/**
	 * Get mini-lessons due for review based on user's SRS progress
	 * @param {number} limit - Maximum number of lessons to return
	 * @returns {Promise<Array>} Array of due mini-lessons
	 */
	async getDueMiniLessons(limit = 5) {
		try {
			// Get user progress for mini-lessons
			const progressData = this.progressService.getStoredData();
			const lessonProgress = this.extractLessonProgress(progressData);

			const response = await fetch(`${this.baseURL}/content/mini-lessons/due`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					lesson_progress: lessonProgress,
				}),
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch due lessons: ${response.status}`);
			}

			const dueLessons = await response.json();

			// Sort by priority and limit results
			return this.prioritizeLessons(dueLessons).slice(0, limit);
		} catch (error) {
			console.error("Error fetching due mini-lessons:", error);
			// Fallback: return new lessons for first-time users
			return this.getNewUserLessons(limit);
		}
	}

	/**
	 * Get mini-lessons for specific error pattern
	 * @param {string} errorPattern - Error pattern to match
	 * @returns {Promise<Array>} Array of matching mini-lessons
	 */
	async getLessonsForError(errorPattern) {
		try {
			const cacheKey = `error_${errorPattern}`;
			const cached = this.getCachedData(cacheKey);
			if (cached) return cached;

			const response = await fetch(
				`${this.baseURL}/content/mini-lessons/for-error/${encodeURIComponent(errorPattern)}`,
			);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch lessons for error: ${response.status}`,
				);
			}

			const lessons = await response.json();
			this.setCachedData(cacheKey, lessons);
			return lessons;
		} catch (error) {
			console.error("Error fetching lessons for error:", error);
			return [];
		}
	}

	/**
	 * Check if a mini-lesson should be triggered based on error patterns
	 * @param {Array<string>} recentErrors - Recent error patterns
	 * @param {string} lessonId - Mini-lesson ID to check
	 * @returns {Promise<boolean>} Whether lesson should be triggered
	 */
	async shouldTriggerLesson(recentErrors, lessonId) {
		try {
			const lesson = await this.getMiniLesson(lessonId);
			if (!lesson) return false;

			const triggers = lesson.triggers || {};
			const minOccurrences = triggers.min_occurrences || 2;
			const timeWindowHours = triggers.time_window_hours || 24;
			const confidenceThreshold = triggers.confidence_threshold || 0.7;

			// Count matching errors in time window
			const now = new Date();
			const timeWindow = timeWindowHours * 60 * 60 * 1000;
			const cutoffTime = new Date(now.getTime() - timeWindow);

			const matchingErrors = recentErrors.filter((errorData) => {
				const errorTime = new Date(errorData.timestamp);
				if (errorTime < cutoffTime) return false;

				// Check if error pattern matches lesson patterns
				const errorPatterns = lesson.error_patterns || [];
				return errorPatterns.some((pattern) => {
					try {
						// Sanitize the pattern to prevent regex injection
						const sanitizedPattern = this.sanitizeRegexPattern(pattern);
						const regex = new RegExp(sanitizedPattern);
						return regex.test(errorData.pattern);
					} catch (error) {
						console.warn(
							"Invalid regex pattern in mini-lesson:",
							pattern,
							error,
						);
						return false;
					}
				});
			});

			// Check if trigger conditions are met
			if (matchingErrors.length < minOccurrences) return false;

			// Calculate confidence (average of matching errors)
			const avgConfidence =
				matchingErrors.reduce(
					(sum, error) => sum + (error.confidence || 1),
					0,
				) / matchingErrors.length;

			return avgConfidence >= confidenceThreshold;
		} catch (error) {
			console.error("Error checking lesson trigger:", error);
			return false;
		}
	}

	/**
	 * Update mini-lesson completion and progress
	 * @param {string} lessonId - Lesson ID
	 * @param {object} completionData - Completion data
	 * @param {number} completionData.accuracyScore - Accuracy score (0-1)
	 * @param {number} completionData.timeSpentMs - Time spent in milliseconds
	 * @param {Array} completionData.drillResults - Individual drill results
	 * @param {boolean} completionData.completed - Whether lesson was completed
	 */
	updateLessonProgress(lessonId, completionData) {
		try {
			const { accuracyScore, timeSpentMs, drillResults = [] } = completionData;

			// Create a drill result for the mini-lesson
			this.progressService.updateDrillResult({
				grammarId: lessonId,
				drillType: "mini_lesson",
				userAnswer: `accuracy_${Math.round(accuracyScore * 100)}`,
				correctAnswer: "completed",
				isCorrect: accuracyScore >= 0.7, // Consider 70% accuracy as successful
				responseTimeMs: timeSpentMs,
				hintUsed: false,
			});

			// Store additional mini-lesson specific data
			const data = this.progressService.getStoredData();
			if (!data.miniLessonProgress) {
				data.miniLessonProgress = {};
			}

			data.miniLessonProgress[lessonId] = {
				lessonId,
				completedAt: new Date().toISOString(),
				accuracyScore,
				timeSpentMs,
				drillResults,
				totalAttempts:
					(data.miniLessonProgress[lessonId]?.totalAttempts || 0) + 1,
			};

			this.progressService.saveData(data);
		} catch (error) {
			console.error("Error updating lesson progress:", error);
			throw error;
		}
	}

	/**
	 * Get mini-lesson statistics
	 * @returns {object} Statistics object
	 */
	getLessonStatistics() {
		const data = this.progressService.getStoredData();
		if (!data || !data.miniLessonProgress) {
			return {
				totalLessonsCompleted: 0,
				averageAccuracy: 0,
				totalTimeSpent: 0,
				lessonsThisWeek: 0,
			};
		}

		const lessonProgress = Object.values(data.miniLessonProgress);
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);

		const recentLessons = lessonProgress.filter(
			(lesson) => new Date(lesson.completedAt) >= weekAgo,
		);

		const totalAccuracy = lessonProgress.reduce(
			(sum, lesson) => sum + lesson.accuracyScore,
			0,
		);

		const totalTime = lessonProgress.reduce(
			(sum, lesson) => sum + lesson.timeSpentMs,
			0,
		);

		return {
			totalLessonsCompleted: lessonProgress.length,
			averageAccuracy:
				lessonProgress.length > 0
					? Math.round((totalAccuracy / lessonProgress.length) * 100) / 100
					: 0,
			totalTimeSpent: Math.round(totalTime / 1000), // Convert to seconds
			lessonsThisWeek: recentLessons.length,
		};
	}

	/**
	 * Extract lesson progress from overall progress data
	 * @param {object} progressData - Full progress data
	 * @returns {object} Lesson-specific progress
	 */
	extractLessonProgress(progressData) {
		if (!progressData || !progressData.progress) return {};

		const lessonProgress = {};

		// Convert grammar progress to lesson progress format
		for (const [grammarId, progress] of Object.entries(progressData.progress)) {
			if (
				grammarId.includes("mini_lesson") ||
				progress.drillType === "mini_lesson"
			) {
				lessonProgress[grammarId] = {
					next_review: progress.nextDueDate,
					mastery_level: progress.masteryLevel,
					total_attempts: progress.totalAttempts,
					accuracy:
						progress.totalAttempts > 0
							? progress.correctAttempts / progress.totalAttempts
							: 0,
				};
			}
		}

		// Add mini-lesson specific progress
		if (progressData.miniLessonProgress) {
			for (const [lessonId, lessonData] of Object.entries(
				progressData.miniLessonProgress,
			)) {
				lessonProgress[lessonId] = {
					...(lessonProgress[lessonId] || {}),
					last_completed: lessonData.completedAt,
					average_accuracy: lessonData.accuracyScore,
					total_attempts: lessonData.totalAttempts,
				};
			}
		}

		return lessonProgress;
	}

	/**
	 * Prioritize lessons based on user needs
	 * @param {Array} lessons - Array of lessons to prioritize
	 * @returns {Array} Prioritized lessons
	 */
	prioritizeLessons(lessons) {
		const progressData = this.progressService.getStoredData();
		const lessonProgress = this.extractLessonProgress(progressData);

		return lessons.sort((a, b) => {
			let priorityA = 0;
			let priorityB = 0;

			// Higher priority for lessons matching user's level
			const userLevel = this.getUserLevel();
			if (a.level?.includes(userLevel)) priorityA += 10;
			if (b.level?.includes(userLevel)) priorityB += 10;

			// Higher priority for lessons with lower accuracy
			const progressA = lessonProgress[a.id];
			const progressB = lessonProgress[b.id];

			if (progressA) priorityA -= progressA.accuracy * 5;
			if (progressB) priorityB -= progressB.accuracy * 5;

			// Higher priority for lessons not yet attempted
			if (!progressA) priorityA += 5;
			if (!progressB) priorityB += 5;

			return priorityB - priorityA;
		});
	}

	/**
	 * Get user's current level based on progress
	 * @returns {string} User level (A2, B1, B2, etc.)
	 */
	getUserLevel() {
		const stats = this.progressService.getUserStatistics();

		if (stats.averageMasteryLevel >= 4) return "B2";
		if (stats.averageMasteryLevel >= 3) return "B1";
		return "A2"; // Default for beginners
	}

	/**
	 * Get lessons for new users
	 * @param {number} limit - Number of lessons to return
	 * @returns {Promise<Array>} Array of beginner-friendly lessons
	 */
	async getNewUserLessons(limit = 3) {
		try {
			const allLessons = await this.getMiniLessons();

			// Filter for A2 level lessons
			const beginnerLessons = allLessons.filter((lesson) =>
				lesson.level?.includes("A2"),
			);

			return beginnerLessons.slice(0, limit);
		} catch (error) {
			console.error("Error getting new user lessons:", error);
			return [];
		}
	}

	/**
	 * Cache management
	 */
	getCachedData(key) {
		const cached = this.cache.get(key);
		if (!cached) return null;

		if (Date.now() - cached.timestamp > this.cacheTTL) {
			this.cache.delete(key);
			return null;
		}

		return cached.data;
	}

	setCachedData(key, data) {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		});
	}

	clearCache() {
		this.cache.clear();
	}

	/**
	 * Sanitize regex pattern to prevent regex injection attacks
	 * @param {string} pattern - The regex pattern to sanitize
	 * @returns {string} Sanitized regex pattern
	 */
	sanitizeRegexPattern(pattern) {
		if (!pattern || typeof pattern !== "string") {
			return "";
		}

		// Limit pattern length to prevent ReDoS attacks
		if (pattern.length > 100) {
			throw new Error("Regex pattern too long");
		}

		// Remove potentially dangerous constructs
		const dangerous = [
			/(\(\?#)/g, // Comment groups
			/(\(\?<)/g, // Lookbehind assertions
			/(\(\?=)/g, // Lookahead assertions
			/(\(\?!)/g, // Negative lookahead
			/(\(\?<!)/g, // Negative lookbehind
			/(\\\\)/g, // Excessive backslashes
			/(\{\d{3,}\})/g, // Large quantifiers
			/(\{,\d{3,}\})/g, // Large open quantifiers
		];

		let sanitized = pattern;
		for (const dangerousPattern of dangerous) {
			sanitized = sanitized.replace(dangerousPattern, "");
		}

		// Escape common regex metacharacters if they appear to be unintended
		// Only allow basic word boundaries, character classes, and simple quantifiers
		const allowedPattern = /^[\w\s.*+?[\]\\b()|^$-]+$/;
		if (!allowedPattern.test(sanitized)) {
			// If pattern contains unexpected characters, escape them
			sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}

		return sanitized;
	}
}

// Export for use in main application
export default MiniLessonService;
