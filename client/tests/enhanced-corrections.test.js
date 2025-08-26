/**
 * Tests for Enhanced Grammar Corrections System
 */

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnhancedCorrectionsSystem } from "../enhanced-corrections.js";

// Mock DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Test</title></head>
    <body>
      <div id="transcript-area"></div>
      <button id="mic-button"></button>
    </body>
  </html>
`);

global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;

// Mock Audio and fetch
global.Audio = vi.fn(() => ({
	play: vi.fn(),
	onended: null,
}));

global.fetch = vi.fn();
global.URL = {
	createObjectURL: vi.fn(() => "blob:test-url"),
	revokeObjectURL: vi.fn(),
};

// Mock btoa
global.btoa = vi.fn((str) => Buffer.from(str, "binary").toString("base64"));

describe("EnhancedCorrectionsSystem", () => {
	let correctionsSystem;

	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = `
      <div id="transcript-area"></div>
      <button id="mic-button"></button>
    `;

		// Create fresh instance
		correctionsSystem = new EnhancedCorrectionsSystem();

		// Clear all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Clean up
		for (const style of document.head.querySelectorAll("style")) {
			style.remove();
		}
	});

	describe("Initialization", () => {
		it("should initialize with correct default properties", () => {
			expect(correctionsSystem.corrections).toBeInstanceOf(Map);
			expect(correctionsSystem.correctionHistory).toEqual([]);
			expect(correctionsSystem.isHighlightMode).toBe(false);
			expect(correctionsSystem.audioContext).toBeNull();
		});

		it("should inject styles into document head", () => {
			const styleSheets = document.head.querySelectorAll("style");
			expect(styleSheets.length).toBeGreaterThan(0);

			const styles = styleSheets[styleSheets.length - 1].textContent;
			expect(styles).toContain(".correction-chip-enhanced");
			expect(styles).toContain(".correction-details-enhanced");
		});

		it("should add keyboard event listener", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener");
			new EnhancedCorrectionsSystem();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"keydown",
				expect.any(Function),
			);
			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"click",
				expect.any(Function),
			);
		});
	});

	describe("Correction Processing", () => {
		const sampleCorrections = [
			{
				before: "аз съм",
				after: "аз съм бил",
				type: "grammar",
				note: "Use past perfect tense",
			},
			{
				before: "много хубав",
				after: "много хубаво",
				type: "adjective_agreement",
				note: "Adjective should agree with noun",
			},
		];

		it("should process corrections correctly", () => {
			const result = correctionsSystem.processCorrections(sampleCorrections);

			expect(result).toContain("corrections-enhanced");
			expect(result).toContain("Grammar Corrections");
			expect(result).toContain("аз съм → <strong>аз съм бил</strong>");
			expect(result).toContain("много хубав → <strong>много хубаво</strong>");
		});

		it("should return empty string for no corrections", () => {
			const result = correctionsSystem.processCorrections([]);
			expect(result).toBe("");

			const result2 = correctionsSystem.processCorrections(null);
			expect(result2).toBe("");
		});

		it("should store corrections in internal map", () => {
			correctionsSystem.processCorrections(sampleCorrections);

			expect(correctionsSystem.corrections.size).toBe(2);

			const correctionEntries = Array.from(
				correctionsSystem.corrections.values(),
			);
			expect(correctionEntries[0].before).toBe("аз съм");
			expect(correctionEntries[0].severity).toBe("high"); // grammar is high severity
			expect(correctionEntries[1].severity).toBe("low"); // adjective_agreement is low severity
		});
	});

	describe("Correction ID Generation", () => {
		it("should generate unique IDs for different corrections", () => {
			const correction1 = { before: "test1", after: "test2", type: "grammar" };
			const correction2 = {
				before: "test3",
				after: "test4",
				type: "vocabulary",
			};

			const id1 = correctionsSystem.generateCorrectionId(correction1);
			const id2 = correctionsSystem.generateCorrectionId(correction2);

			expect(id1).not.toBe(id2);
			expect(typeof id1).toBe("string");
			expect(typeof id2).toBe("string");
			expect(id1.length).toBeLessThanOrEqual(16);
		});

		it("should generate same ID for identical corrections", () => {
			const correction = { before: "test", after: "test2", type: "grammar" };

			const id1 = correctionsSystem.generateCorrectionId(correction);
			const id2 = correctionsSystem.generateCorrectionId(correction);

			expect(id1).toBe(id2);
		});
	});

	describe("Severity Determination", () => {
		it("should assign high severity to grammar/syntax errors", () => {
			expect(correctionsSystem.determineSeverity({ type: "grammar" })).toBe(
				"high",
			);
			expect(correctionsSystem.determineSeverity({ type: "syntax" })).toBe(
				"high",
			);
			expect(
				correctionsSystem.determineSeverity({ type: "verb_conjugation" }),
			).toBe("high");
		});

		it("should assign medium severity to vocabulary/preposition errors", () => {
			expect(correctionsSystem.determineSeverity({ type: "vocabulary" })).toBe(
				"medium",
			);
			expect(correctionsSystem.determineSeverity({ type: "preposition" })).toBe(
				"medium",
			);
			expect(correctionsSystem.determineSeverity({ type: "case" })).toBe(
				"medium",
			);
		});

		it("should assign low severity to other error types", () => {
			expect(
				correctionsSystem.determineSeverity({ type: "pronunciation" }),
			).toBe("low");
			expect(
				correctionsSystem.determineSeverity({ type: "adjective_agreement" }),
			).toBe("low");
			expect(correctionsSystem.determineSeverity({ type: "unknown" })).toBe(
				"low",
			);
		});
	});

	describe("Severity Icons", () => {
		it("should return correct icons for severity levels", () => {
			expect(correctionsSystem.getSeverityIcon("high")).toBe("🔴");
			expect(correctionsSystem.getSeverityIcon("medium")).toBe("🟡");
			expect(correctionsSystem.getSeverityIcon("low")).toBe("🟢");
			expect(correctionsSystem.getSeverityIcon("unknown")).toBe("⚪");
		});
	});

	describe("Highlight Mode", () => {
		it("should toggle highlight mode", () => {
			expect(correctionsSystem.isHighlightMode).toBe(false);
			expect(document.body.classList.contains("highlight-mode")).toBe(false);

			correctionsSystem.toggleHighlightMode();

			expect(correctionsSystem.isHighlightMode).toBe(true);
			expect(document.body.classList.contains("highlight-mode")).toBe(true);

			correctionsSystem.toggleHighlightMode();

			expect(correctionsSystem.isHighlightMode).toBe(false);
			expect(document.body.classList.contains("highlight-mode")).toBe(false);
		});

		it("should handle keyboard shortcut for highlight mode", () => {
			const toggleSpy = vi.spyOn(correctionsSystem, "toggleHighlightMode");

			// Simulate Ctrl+H
			const event = new dom.window.KeyboardEvent("keydown", {
				key: "h",
				ctrlKey: true,
				bubbles: true,
			});

			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
			});

			document.dispatchEvent(event);

			expect(event.preventDefault).toHaveBeenCalled();
			expect(toggleSpy).toHaveBeenCalled();
		});
	});

	describe("Correction Interaction", () => {
		beforeEach(() => {
			// Add sample correction to test interaction
			const sampleCorrection = {
				before: "test",
				after: "corrected",
				type: "grammar",
				note: "Test correction",
			};

			const correctionId =
				correctionsSystem.generateCorrectionId(sampleCorrection);
			correctionsSystem.corrections.set(correctionId, {
				...sampleCorrection,
				index: 0,
				severity: "high",
				timestamp: Date.now(),
				practiceCount: 0,
				isVisible: false,
			});

			// Add correction details element to DOM
			const detailsElement = document.createElement("div");
			detailsElement.id = `correction-details-${correctionId}`;
			detailsElement.className = "correction-details-enhanced";
			detailsElement.style.display = "none";
			document.body.appendChild(detailsElement);
		});

		it("should handle correction click and show details", () => {
			const corrections = Array.from(correctionsSystem.corrections.entries());
			const [correctionId, correction] = corrections[0];

			correctionsSystem.handleCorrectionClick(correctionId);

			const detailsElement = document.getElementById(
				`correction-details-${correctionId}`,
			);
			expect(detailsElement.style.display).toBe("block");
			expect(correction.isVisible).toBe(true);
			expect(correctionsSystem.correctionHistory).toHaveLength(1);
			expect(correctionsSystem.correctionHistory[0].action).toBe("view");
		});

		it("should hide other correction details when showing new one", () => {
			// Add another correction
			const correction2 = {
				before: "test2",
				after: "corrected2",
				type: "vocabulary",
				note: "Test correction 2",
			};

			const correctionId2 = correctionsSystem.generateCorrectionId(correction2);
			correctionsSystem.corrections.set(correctionId2, {
				...correction2,
				index: 1,
				severity: "medium",
				timestamp: Date.now(),
				practiceCount: 0,
				isVisible: false,
			});

			const detailsElement2 = document.createElement("div");
			detailsElement2.id = `correction-details-${correctionId2}`;
			detailsElement2.className = "correction-details-enhanced";
			detailsElement2.style.display = "none";
			document.body.appendChild(detailsElement2);

			// Show first correction
			const correctionIds = Array.from(correctionsSystem.corrections.keys());
			correctionsSystem.handleCorrectionClick(correctionIds[0]);

			// Show second correction - should hide first
			correctionsSystem.handleCorrectionClick(correctionIds[1]);

			const details1 = document.getElementById(
				`correction-details-${correctionIds[0]}`,
			);
			const details2 = document.getElementById(
				`correction-details-${correctionIds[1]}`,
			);

			expect(details1.style.display).toBe("none");
			expect(details2.style.display).toBe("block");
		});
	});

	describe("Audio Playback", () => {
		beforeEach(() => {
			// Mock successful fetch response
			const mockBlob = new Blob(["audio data"], { type: "audio/wav" });
			fetch.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});
		});

		it("should play correction audio", async () => {
			const correction = {
				before: "test",
				after: "тест",
				type: "pronunciation",
			};

			const correctionId = correctionsSystem.generateCorrectionId(correction);
			correctionsSystem.corrections.set(correctionId, correction);

			await correctionsSystem.playCorrection(correctionId);

			expect(fetch).toHaveBeenCalledWith("/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: "тест",
					voice: "bg",
					speed: 0.8,
				}),
			});

			expect(Audio).toHaveBeenCalled();
			expect(URL.createObjectURL).toHaveBeenCalled();
		});

		it("should handle audio playback errors", async () => {
			fetch.mockRejectedValue(new Error("TTS not available"));
			const showNotificationSpy = vi.spyOn(
				correctionsSystem,
				"showNotification",
			);

			const correctionId = "test-id";
			correctionsSystem.corrections.set(correctionId, { after: "test" });

			await correctionsSystem.playCorrection(correctionId);

			expect(showNotificationSpy).toHaveBeenCalledWith(
				"Audio playback not available",
				"error",
			);
		});
	});

	describe("Practice Mode", () => {
		it("should increment practice count and update UI", () => {
			const correction = {
				before: "test",
				after: "corrected",
				type: "grammar",
				practiceCount: 0,
			};

			const correctionId = correctionsSystem.generateCorrectionId(correction);
			correctionsSystem.corrections.set(correctionId, correction);

			// Create progress bar element
			const progressBar = document.createElement("div");
			progressBar.className = "correction-progress-bar";
			progressBar.style.width = "0%";

			const progressContainer = document.createElement("div");
			progressContainer.id = `correction-details-${correctionId}`;
			progressContainer.appendChild(progressBar);
			document.body.appendChild(progressContainer);

			const showPracticePromptSpy = vi.spyOn(
				correctionsSystem,
				"showPracticePrompt",
			);

			correctionsSystem.startPractice(correctionId);

			expect(correction.practiceCount).toBe(1);
			expect(progressBar.style.width).toBe("20%"); // 1/5 * 100%
			expect(showPracticePromptSpy).toHaveBeenCalledWith(correction);
		});

		it("should show practice prompt and animate mic button", () => {
			const correction = { after: "corrected" };
			const showNotificationSpy = vi.spyOn(
				correctionsSystem,
				"showNotification",
			);

			correctionsSystem.showPracticePrompt(correction);

			expect(showNotificationSpy).toHaveBeenCalledWith(
				'Try using the correct form: "corrected" in a sentence.',
				"info",
				5000,
			);

			const micButton = document.getElementById("mic-button");
			expect(micButton.style.animation).toBe("pulse 1s ease-in-out 3");
		});
	});

	describe("Statistics", () => {
		it("should calculate statistics correctly", () => {
			const corrections = [
				{
					before: "test1",
					after: "corrected1",
					type: "grammar",
					practiceCount: 2,
				},
				{
					before: "test2",
					after: "corrected2",
					type: "vocabulary",
					practiceCount: 1,
				},
				{
					before: "test3",
					after: "corrected3",
					type: "pronunciation",
					practiceCount: 0,
				},
			];

			corrections.forEach((correction, index) => {
				const id = correctionsSystem.generateCorrectionId(correction);
				correctionsSystem.corrections.set(id, {
					...correction,
					severity: correctionsSystem.determineSeverity(correction),
					index,
					timestamp: Date.now(),
					isVisible: false,
				});
			});

			const stats = correctionsSystem.getStatistics();

			expect(stats.totalCorrections).toBe(3);
			expect(stats.severityBreakdown.high).toBe(1); // grammar
			expect(stats.severityBreakdown.medium).toBe(1); // vocabulary
			expect(stats.severityBreakdown.low).toBe(1); // pronunciation
			expect(stats.totalPractice).toBe(3);
			expect(stats.averagePractice).toBe(1);
		});

		it("should handle empty corrections for statistics", () => {
			const stats = correctionsSystem.getStatistics();

			expect(stats.totalCorrections).toBe(0);
			expect(stats.totalPractice).toBe(0);
			expect(stats.averagePractice).toBe(0);
		});
	});

	describe("Export Functionality", () => {
		it("should export correction history", () => {
			const correction = {
				before: "test",
				after: "corrected",
				type: "grammar",
			};
			const correctionId = correctionsSystem.generateCorrectionId(correction);

			correctionsSystem.corrections.set(correctionId, {
				...correction,
				severity: "high",
				practiceCount: 1,
			});

			correctionsSystem.correctionHistory.push({
				correctionId,
				action: "view",
				timestamp: Date.now(),
			});

			const exported = correctionsSystem.exportHistory();

			expect(exported.corrections).toHaveLength(1);
			expect(exported.history).toHaveLength(1);
			expect(exported.statistics).toHaveProperty("totalCorrections", 1);
		});
	});

	describe("Notification System", () => {
		it("should use window.showToast if available", () => {
			const mockShowToast = vi.fn();
			global.window.showToast = mockShowToast;

			correctionsSystem.showNotification("Test message", "info");

			expect(mockShowToast).toHaveBeenCalledWith("Test message", "info");
		});

		it("should fallback to console.log if no toast system", () => {
			global.window.showToast = undefined;
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			correctionsSystem.showNotification("Test message", "error");

			expect(consoleSpy).toHaveBeenCalledWith("[ERROR] Test message");

			consoleSpy.mockRestore();
		});
	});
});
