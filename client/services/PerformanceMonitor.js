/**
 * Performance Monitor Service for Bulgarian Voice Coach
 *
 * Tracks latency metrics across the entire audio pipeline:
 * - VAD detection time
 * - ASR processing time
 * - LLM response time
 * - TTS generation time
 * - End-to-end latency
 *
 * Provides real-time metrics and historical statistics
 */

class PerformanceMonitor {
	constructor() {
		// Latency tracking
		this.metrics = {
			vad: [],
			asr: [],
			llm: [],
			tts: [],
			e2e: [],
			websocket: [],
		};

		// Current timing session
		this.currentSession = null;

		// Configuration
		this.config = {
			maxHistorySize: 100,
			targetLatency: 2000, // 2.0s target
			warningLatency: 3000, // 3.0s warning threshold
			criticalLatency: 5000, // 5.0s critical threshold
		};

		// Statistics cache
		this.statsCache = null;
		this.statsCacheTime = 0;
		this.cacheValidityMs = 1000; // Refresh stats every second
	}

	/**
	 * Start a new performance measurement session
	 * @returns {string} Session ID
	 */
	startSession() {
		// Use cryptographically secure random UUID with timestamp prefix for uniqueness
		const sessionId = `${Date.now()}_${this.generateSecureId()}`;
		this.currentSession = {
			id: sessionId,
			timestamps: {
				start: performance.now(),
				vadStart: null,
				vadEnd: null,
				asrStart: null,
				asrEnd: null,
				llmStart: null,
				llmEnd: null,
				ttsStart: null,
				ttsEnd: null,
				end: null,
			},
			metadata: {
				audioSize: 0,
				transcriptLength: 0,
				responseLength: 0,
				errorCount: 0,
			},
		};
		return sessionId;
	}

	/**
	 * Mark a timing point in the current session
	 * @param {string} stage - Stage name (vadStart, asrEnd, etc.)
	 * @param {object} metadata - Optional metadata to store
	 */
	mark(stage, metadata = {}) {
		if (!this.currentSession) {
			console.warn("No active performance session");
			return;
		}

		this.currentSession.timestamps[stage] = performance.now();

		// Update metadata if provided
		Object.assign(this.currentSession.metadata, metadata);

		// Calculate intermediate metrics when stage completes
		if (stage.endsWith("End")) {
			this.calculateStageMetric(stage);
		}

		// Calculate end-to-end when session completes
		if (stage === "end") {
			this.finalizeSession();
		}
	}

	/**
	 * Calculate metrics for a completed stage
	 * @param {string} endStage - The end stage marker
	 */
	calculateStageMetric(endStage) {
		const stage = endStage.replace("End", "");
		const startTime = this.currentSession.timestamps[`${stage}Start`];
		const endTime = this.currentSession.timestamps[endStage];

		if (startTime && endTime) {
			const duration = endTime - startTime;
			this.addMetric(stage, duration);
		}
	}

	/**
	 * Add a metric value to history
	 * @param {string} type - Metric type (vad, asr, llm, tts, e2e, websocket)
	 * @param {number} value - Duration in milliseconds
	 */
	addMetric(type, value) {
		if (!this.metrics[type]) {
			this.metrics[type] = [];
		}

		this.metrics[type].push({
			value: Math.round(value),
			timestamp: Date.now(),
			sessionId: this.currentSession?.id,
		});

		// Maintain history size limit
		if (this.metrics[type].length > this.config.maxHistorySize) {
			this.metrics[type].shift();
		}

		// Invalidate stats cache
		this.statsCache = null;
	}

	/**
	 * Finalize the current session and calculate end-to-end metrics
	 */
	finalizeSession() {
		if (!this.currentSession) return;

		const e2e =
			this.currentSession.timestamps.end - this.currentSession.timestamps.start;
		this.addMetric("e2e", e2e);

		// Store session for detailed analysis
		this.lastSession = { ...this.currentSession };
		this.currentSession = null;
	}

	/**
	 * Get current statistics for all metrics
	 * @returns {object} Statistics object
	 */
	getStatistics() {
		const now = Date.now();

		// Return cached stats if still valid
		if (this.statsCache && now - this.statsCacheTime < this.cacheValidityMs) {
			return this.statsCache;
		}

		const stats = {};

		for (const [type, values] of Object.entries(this.metrics)) {
			if (values.length === 0) {
				stats[type] = {
					count: 0,
					min: 0,
					max: 0,
					avg: 0,
					p50: 0,
					p90: 0,
					p99: 0,
					recent: 0,
					trend: "stable",
				};
				continue;
			}

			const sorted = [...values].map((v) => v.value).sort((a, b) => a - b);
			const sum = sorted.reduce((acc, val) => acc + val, 0);
			const avg = sum / sorted.length;

			// Calculate percentiles
			const p50Index = Math.floor(sorted.length * 0.5);
			const p90Index = Math.floor(sorted.length * 0.9);
			const p99Index = Math.floor(sorted.length * 0.99);

			// Calculate trend (comparing recent vs older values)
			const recentCount = Math.min(10, Math.floor(values.length / 2));
			const recentAvg =
				values.slice(-recentCount).reduce((acc, v) => acc + v.value, 0) /
				recentCount;
			const olderAvg =
				values.slice(0, recentCount).reduce((acc, v) => acc + v.value, 0) /
				Math.max(1, recentCount);

			let trend = "stable";
			if (recentAvg > olderAvg * 1.1) trend = "increasing";
			else if (recentAvg < olderAvg * 0.9) trend = "decreasing";

			stats[type] = {
				count: values.length,
				min: Math.round(sorted[0]),
				max: Math.round(sorted[sorted.length - 1]),
				avg: Math.round(avg),
				p50: Math.round(sorted[p50Index] || 0),
				p90: Math.round(sorted[p90Index] || 0),
				p99: Math.round(sorted[p99Index] || 0),
				recent: Math.round(values[values.length - 1]?.value || 0),
				trend,
			};
		}

		// Cache the stats
		this.statsCache = stats;
		this.statsCacheTime = now;

		return stats;
	}

	/**
	 * Get performance level based on end-to-end latency
	 * @param {number} latency - Latency in milliseconds
	 * @returns {object} Performance level and color
	 */
	getPerformanceLevel(latency) {
		if (latency <= this.config.targetLatency) {
			return { level: "excellent", color: "#4ade80", icon: "🟢" };
		} else if (latency <= this.config.warningLatency) {
			return { level: "good", color: "#fbbf24", icon: "🟡" };
		} else if (latency <= this.config.criticalLatency) {
			return { level: "warning", color: "#fb923c", icon: "🟠" };
		} else {
			return { level: "critical", color: "#f87171", icon: "🔴" };
		}
	}

	/**
	 * Track WebSocket round-trip time
	 * @param {string} messageId - Unique message identifier
	 */
	startWebSocketTiming(messageId) {
		if (!this.wsTimings) {
			this.wsTimings = new Map();
		}
		this.wsTimings.set(messageId, performance.now());
	}

	/**
	 * Complete WebSocket round-trip timing
	 * @param {string} messageId - Unique message identifier
	 */
	endWebSocketTiming(messageId) {
		if (!this.wsTimings || !this.wsTimings.has(messageId)) {
			return;
		}

		const startTime = this.wsTimings.get(messageId);
		const duration = performance.now() - startTime;
		this.wsTimings.delete(messageId);

		this.addMetric("websocket", duration);
		return duration;
	}

	/**
	 * Get formatted statistics for display
	 * @returns {string} Formatted statistics text
	 */
	getFormattedStats() {
		const stats = this.getStatistics();
		const e2eStats = stats.e2e;

		if (e2eStats.count === 0) {
			return "No performance data yet";
		}

		const level = this.getPerformanceLevel(e2eStats.recent);

		return `${level.icon} ${e2eStats.recent}ms (avg: ${e2eStats.avg}ms, p90: ${e2eStats.p90}ms)`;
	}

	/**
	 * Get detailed breakdown for current or last session
	 * @returns {object} Detailed timing breakdown
	 */
	getSessionBreakdown() {
		const session = this.currentSession || this.lastSession;
		if (!session) return null;

		const breakdown = {
			sessionId: session.id,
			stages: {},
			total: 0,
		};

		const stages = ["vad", "asr", "llm", "tts"];

		for (const stage of stages) {
			const startTime = session.timestamps[`${stage}Start`];
			const endTime = session.timestamps[`${stage}End`];

			if (startTime && endTime) {
				const duration = Math.round(endTime - startTime);
				breakdown.stages[stage] = {
					duration,
					percentage: 0, // Will calculate after total
				};
			}
		}

		// Calculate total and percentages
		if (session.timestamps.start && session.timestamps.end) {
			breakdown.total = Math.round(
				session.timestamps.end - session.timestamps.start,
			);

			for (const stage in breakdown.stages) {
				breakdown.stages[stage].percentage = Math.round(
					(breakdown.stages[stage].duration / breakdown.total) * 100,
				);
			}
		}

		return breakdown;
	}

	/**
	 * Export metrics data for analysis
	 * @returns {object} Exportable metrics data
	 */
	exportMetrics() {
		return {
			metrics: this.metrics,
			statistics: this.getStatistics(),
			config: this.config,
			exportTime: new Date().toISOString(),
		};
	}

	/**
	 * Clear all metrics history
	 */
	clearMetrics() {
		for (const key in this.metrics) {
			this.metrics[key] = [];
		}
		this.statsCache = null;
		this.currentSession = null;
		this.lastSession = null;
		this.wsTimings?.clear();
	}

	/**
	 * Generate performance report
	 * @returns {object} Performance report
	 */
	generateReport() {
		const stats = this.getStatistics();
		const report = {
			summary: {
				measurementCount: stats.e2e.count,
				averageLatency: stats.e2e.avg,
				targetMet: stats.e2e.avg <= this.config.targetLatency,
				performanceLevel: this.getPerformanceLevel(stats.e2e.avg).level,
			},
			breakdown: {
				vad: `${stats.vad.avg}ms (${this.calculatePercentage(stats.vad.avg, stats.e2e.avg)}%)`,
				asr: `${stats.asr.avg}ms (${this.calculatePercentage(stats.asr.avg, stats.e2e.avg)}%)`,
				llm: `${stats.llm.avg}ms (${this.calculatePercentage(stats.llm.avg, stats.e2e.avg)}%)`,
				tts: `${stats.tts.avg}ms (${this.calculatePercentage(stats.tts.avg, stats.e2e.avg)}%)`,
			},
			bottlenecks: this.identifyBottlenecks(stats),
			recommendations: this.generateRecommendations(stats),
		};

		return report;
	}

	/**
	 * Calculate percentage of total
	 * @private
	 */
	calculatePercentage(value, total) {
		if (total === 0) return 0;
		return Math.round((value / total) * 100);
	}

	/**
	 * Identify performance bottlenecks
	 * @private
	 */
	identifyBottlenecks(stats) {
		const bottlenecks = [];
		const stages = ["vad", "asr", "llm", "tts"];

		for (const stage of stages) {
			const stageStats = stats[stage];
			if (stageStats.avg > 500) {
				// More than 500ms is considered slow
				bottlenecks.push({
					stage,
					avgTime: stageStats.avg,
					trend: stageStats.trend,
					severity: stageStats.avg > 1000 ? "high" : "medium",
				});
			}
		}

		return bottlenecks.sort((a, b) => b.avgTime - a.avgTime);
	}

	/**
	 * Generate performance recommendations
	 * @private
	 */
	generateRecommendations(stats) {
		const recommendations = [];

		if (stats.vad.avg > 400) {
			recommendations.push("Consider reducing VAD tail timing to 200-300ms");
		}

		if (stats.asr.avg > 800) {
			recommendations.push(
				"ASR is slow - consider optimizing beam_size or using a smaller model",
			);
		}

		if (stats.llm.avg > 1000) {
			recommendations.push(
				"LLM response time is high - consider caching common responses",
			);
		}

		if (stats.tts.avg > 500) {
			recommendations.push(
				"TTS generation is slow - consider pre-generating common phrases",
			);
		}

		if (stats.websocket.avg > 100) {
			recommendations.push(
				"WebSocket latency is high - check network conditions",
			);
		}

		if (stats.e2e.trend === "increasing") {
			recommendations.push(
				"Performance is degrading over time - check for memory leaks",
			);
		}

		return recommendations;
	}

	/**
	 * Generate cryptographically secure random identifier
	 * @returns {string} Secure random ID
	 * @private
	 */
	generateSecureId() {
		// Use crypto.randomUUID() if available (modern browsers)
		if (window.crypto && window.crypto.randomUUID) {
			return window.crypto.randomUUID();
		}

		// Fallback: use crypto.getRandomValues() for secure randomness
		if (window.crypto && window.crypto.getRandomValues) {
			const array = new Uint8Array(16);
			window.crypto.getRandomValues(array);
			return Array.from(array, (byte) =>
				`0${byte.toString(16)}`.slice(-2),
			).join("");
		}

		// Last resort fallback for very old browsers (still better than Math.random)
		console.warn("Using insecure fallback for random ID generation");
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}
}

// Export for use in main application
export default PerformanceMonitor;
