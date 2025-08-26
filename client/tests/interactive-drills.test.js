/**
 * Tests for Interactive Drill Practice System
 */

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveDrillSystem } from "../interactive-drills.js";

// Mock DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Test</title></head>
    <body>
      <div class="transcript-area"></div>
    </body>
  </html>
`);

global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.CustomEvent = dom.window.CustomEvent;

// Use JSDOM's localStorage and create vitest mocks
global.localStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	key: vi.fn(),
	length: 0,
};

// Override window.localStorage with our mock
Object.defineProperty(global.window, "localStorage", {
	value: global.localStorage,
	writable: true,
});

describe("InteractiveDrillSystem", () => {
	let drillSystem;
	let mockDrills;

	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = `
      <div class="transcript-area"></div>
    `;

		// Reset localStorage mocks
		vi.clearAllMocks();
		localStorage.getItem.mockReturnValue(null);

		// Mock console.log and console.warn to reduce test noise
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});

		// Create fresh instance
		drillSystem = new InteractiveDrillSystem();

		// Sample drill data
		mockDrills = [
			{
				id: "drill1",
				prompt_bg: "Искам ___ (поръчвам) кафе.",
				answer_bg: "да поръчам",
				level: "A2",
				type: "transform",
				hint: "Use да + present tense",
			},
			{
				id: "drill2",
				prompt_bg: "Трябва ___ (купувам) билет.",
				answer_bg: "да купя",
				level: "B1",
				type: "transform",
				hint: "Remember the perfective form",
			},
		];
	});

	afterEach(() => {
		// Clean up modals and styles
		for (const modal of document.querySelectorAll(".drill-practice-modal")) {
			modal.remove();
		}
		for (const style of document.head.querySelectorAll("style")) {
			style.remove();
		}

		// Restore mocks
		vi.restoreAllMocks();
	});

	describe("Initialization", () => {
		it("should initialize with correct default properties", () => {
			expect(drillSystem.drills).toBeInstanceOf(Map);
			expect(drillSystem.progress).toBeInstanceOf(Map);
			expect(drillSystem.currentDrill).toBeNull();
			expect(drillSystem.currentMode).toBe("practice");
			expect(drillSystem.isActive).toBe(false);
			expect(drillSystem.userInput).toBe("");
			expect(drillSystem.attempts).toBe(0);
			expect(drillSystem.maxAttempts).toBe(3);
		});

		it("should inject styles into document head", () => {
			const styleSheets = document.head.querySelectorAll("style");
			expect(styleSheets.length).toBeGreaterThan(0);

			const styles = styleSheets[styleSheets.length - 1].textContent;
			expect(styles).toContain(".drill-practice-modal");
			expect(styles).toContain(".drill-practice-container");
			expect(styles).toContain(".drill-input");
		});

		it("should setup event listeners for drill practice", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener");
			new InteractiveDrillSystem();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"startDrillPractice",
				expect.any(Function),
			);
			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"keydown",
				expect.any(Function),
			);
		});
	});

	describe("Practice Session Management", () => {
		it("should start practice session with provided drills", () => {
			drillSystem.startPractice(mockDrills, "practice");

			expect(drillSystem.isActive).toBe(true);
			expect(drillSystem.currentMode).toBe("practice");
			expect(drillSystem.drills.size).toBe(1); // One drill moved to currentDrill
			expect(drillSystem.currentDrill).not.toBeNull();

			// Modal should be created
			const modal = document.querySelector(".drill-practice-modal");
			expect(modal).not.toBeNull();
		});

		it("should process drills into internal format correctly", () => {
			drillSystem.startPractice(mockDrills);

			// Check currentDrill since first drill is moved there
			const drill = drillSystem.currentDrill;
			expect(drill.prompt).toBe("Искам ___ (поръчвам) кафе.");
			expect(drill.answer).toBe("да поръчам");
			expect(drill.level).toBe("A2");
			expect(drill.type).toBe("transform");
			expect(drill.hint).toBe("Use да + present tense");
		});

		it("should create practice modal with correct structure", () => {
			drillSystem.startPractice(mockDrills);

			const modal = document.querySelector(".drill-practice-modal");
			expect(modal).not.toBeNull();

			const container = modal.querySelector(".drill-practice-container");
			expect(container).not.toBeNull();

			const header = container.querySelector(".drill-header");
			const progress = container.querySelector(".drill-progress");
			const questionArea = container.querySelector(".drill-question-area");
			const inputArea = container.querySelector(".drill-input-area");
			const actions = container.querySelector(".drill-actions");

			expect(header).not.toBeNull();
			expect(progress).not.toBeNull();
			expect(questionArea).not.toBeNull();
			expect(inputArea).not.toBeNull();
			expect(actions).not.toBeNull();
		});

		it("should close practice session", () => {
			drillSystem.startPractice(mockDrills);
			expect(drillSystem.isActive).toBe(true);

			drillSystem.closePractice();

			expect(drillSystem.isActive).toBe(false);
			expect(drillSystem.currentDrill).toBeNull();
		});
	});

	describe("Drill Navigation", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
		});

		it("should display current drill correctly", () => {
			const promptElement = document.querySelector(".drill-prompt");
			const levelElement = document.querySelector(".drill-level");

			expect(promptElement.textContent).toBe(drillSystem.currentDrill.prompt);
			expect(levelElement.textContent).toBe(
				`Level ${drillSystem.currentDrill.level}`,
			);
		});

		it("should update progress correctly", () => {
			const currentElement = document.querySelector(".drill-current");
			const totalElement = document.querySelector(".drill-total");

			expect(currentElement.textContent).toBe("1");
			expect(totalElement.textContent).toBe("2");
		});

		it("should advance to next drill", () => {
			const firstDrill = drillSystem.currentDrill;
			drillSystem.nextDrill();

			expect(drillSystem.currentDrill).not.toBe(firstDrill);
		});

		it("should complete practice when no more drills", () => {
			const completePracticeSpy = vi.spyOn(drillSystem, "completePractice");

			// Clear all drills
			drillSystem.drills.clear();
			drillSystem.nextDrill();

			expect(completePracticeSpy).toHaveBeenCalled();
		});
	});

	describe("Answer Evaluation", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
		});

		it("should normalize answers for comparison", () => {
			const normalized1 = drillSystem.normalizeAnswer("  Да поръчам  ");
			const normalized2 = drillSystem.normalizeAnswer("да поръчам");

			expect(normalized1).toBe(normalized2);
		});

		it("should evaluate correct answers", () => {
			const result = drillSystem.evaluateAnswer("да поръчам", "да поръчам");

			expect(result.correct).toBe(true);
			expect(result.score).toBe(100);
			expect(result.message).toContain("Perfect");
		});

		it("should evaluate incorrect answers", () => {
			const result = drillSystem.evaluateAnswer("wrong answer", "да поръчам");

			expect(result.correct).toBe(false);
			expect(result.score).toBe(0);
			expect(result.message).toContain("not quite right");
		});

		it("should detect partial matches", () => {
			const result = drillSystem.evaluateAnswer("да поръчва", "да поръчам");

			expect(result.correct).toBe(false);
			expect(result.partial).toBe(true);
			expect(result.score).toBeGreaterThan(50);
		});

		it("should calculate Levenshtein distance correctly", () => {
			const distance = drillSystem.levenshteinDistance("hello", "hallo");
			expect(distance).toBe(1);

			const distance2 = drillSystem.levenshteinDistance("test", "test");
			expect(distance2).toBe(0);
		});
	});

	describe("Answer Checking Process", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
			drillSystem.inputField = document.querySelector(".drill-input");
		});

		it("should handle empty input", () => {
			drillSystem.inputField.value = "";
			const showFeedbackSpy = vi.spyOn(drillSystem, "showFeedback");

			drillSystem.checkAnswer();

			expect(showFeedbackSpy).toHaveBeenCalledWith(
				"Please enter an answer",
				"incorrect",
				"❌",
			);
		});

		it("should handle correct answer", () => {
			drillSystem.inputField.value = drillSystem.currentDrill.answer;
			const showFeedbackSpy = vi.spyOn(drillSystem, "showFeedback");
			const recordProgressSpy = vi.spyOn(drillSystem, "recordProgress");

			drillSystem.checkAnswer();

			expect(showFeedbackSpy).toHaveBeenCalledWith(
				expect.stringContaining("Perfect"),
				"correct",
				"✅",
			);
			expect(recordProgressSpy).toHaveBeenCalledWith(true);
			expect(drillSystem.inputField.classList.contains("correct")).toBe(true);
		});

		it("should handle incorrect answer", () => {
			drillSystem.inputField.value = "wrong answer";
			const showFeedbackSpy = vi.spyOn(drillSystem, "showFeedback");

			drillSystem.checkAnswer();

			expect(showFeedbackSpy).toHaveBeenCalledWith(
				expect.stringContaining("not quite right"),
				"incorrect",
				"❌",
			);
			expect(drillSystem.inputField.classList.contains("incorrect")).toBe(true);
			expect(drillSystem.attempts).toBe(1);
		});

		it("should show correct answer after max attempts", () => {
			drillSystem.inputField.value = "wrong answer";
			const showCorrectAnswerSpy = vi.spyOn(drillSystem, "showCorrectAnswer");

			// Simulate reaching max attempts
			drillSystem.attempts = drillSystem.maxAttempts;
			drillSystem.checkAnswer();

			expect(showCorrectAnswerSpy).toHaveBeenCalled();
		});
	});

	describe("Feedback System", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
			drillSystem.feedbackArea = document.querySelector(".drill-feedback");
		});

		it("should show feedback with correct styling", () => {
			drillSystem.showFeedback("Test message", "correct", "✅");

			expect(drillSystem.feedbackArea.innerHTML).toContain("✅");
			expect(drillSystem.feedbackArea.innerHTML).toContain("Test message");
			expect(drillSystem.feedbackArea.className).toContain("correct");
			expect(drillSystem.feedbackArea.className).toContain("visible");
		});

		it("should hide feedback", () => {
			drillSystem.showFeedback("Test", "correct", "✅");
			drillSystem.hideFeedback();

			expect(drillSystem.feedbackArea.classList.contains("visible")).toBe(
				false,
			);
		});

		it("should show and hide hints", () => {
			const hintElement = document.querySelector(".drill-hint");

			drillSystem.showHint();
			expect(hintElement.classList.contains("visible")).toBe(true);

			drillSystem.hideHint();
			expect(hintElement.classList.contains("visible")).toBe(false);
		});
	});

	describe("Progress Tracking", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
		});

		it("should initialize progress for new drill", () => {
			drillSystem.recordProgress(true);

			const progress = drillSystem.progress.get(drillSystem.currentDrill.id);
			expect(progress).toBeDefined();
			expect(progress.attempts).toBe(1);
			expect(progress.correct).toBe(1);
			expect(progress.interval).toBe(1);
		});

		it("should advance SRS interval on correct answer", () => {
			drillSystem.recordProgress(true);
			drillSystem.recordProgress(true);

			const progress = drillSystem.progress.get(drillSystem.currentDrill.id);
			expect(progress.interval).toBe(2);
		});

		it("should reset SRS interval on wrong answer", () => {
			// First correct answer
			drillSystem.recordProgress(true);
			let progress = drillSystem.progress.get(drillSystem.currentDrill.id);
			expect(progress.interval).toBe(1);

			// Then wrong answer
			drillSystem.recordProgress(false);
			progress = drillSystem.progress.get(drillSystem.currentDrill.id);
			expect(progress.interval).toBe(0);
		});

		it("should save progress to localStorage", () => {
			drillSystem.recordProgress(true);

			expect(localStorage.setItem).toHaveBeenCalledWith(
				"drillProgress",
				expect.any(String),
			);
		});

		it("should load progress from localStorage", () => {
			const mockProgress = JSON.stringify({
				drill1: {
					attempts: 5,
					correct: 3,
					interval: 2,
				},
			});
			localStorage.getItem.mockReturnValue(mockProgress);

			drillSystem.loadProgress();

			expect(drillSystem.progress.has("drill1")).toBe(true);
			expect(drillSystem.progress.get("drill1").attempts).toBe(5);
		});
	});

	describe("Statistics Tracking", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
		});

		it("should update statistics correctly", () => {
			// Record some progress
			drillSystem.progress.set("drill1", { attempts: 3, correct: 2 });
			drillSystem.progress.set("drill2", { attempts: 2, correct: 2 });

			drillSystem.updateStats();

			const correctCount = document.querySelector("#drill-correct-count");
			const attemptsCount = document.querySelector("#drill-attempts-count");
			const accuracy = document.querySelector("#drill-accuracy");

			expect(correctCount.textContent).toBe("4"); // 2+2
			expect(attemptsCount.textContent).toBe("5"); // 3+2
			expect(accuracy.textContent).toBe("80%"); // 4/5
		});

		it("should calculate session stats", () => {
			drillSystem.progress.set("drill1", { attempts: 2, correct: 1 });
			drillSystem.progress.set("drill2", { attempts: 1, correct: 1 });

			const stats = drillSystem.calculateSessionStats();

			expect(stats.totalDrills).toBe(2);
			expect(stats.correct).toBe(2);
			expect(stats.total).toBe(3);
			expect(stats.accuracy).toBe(67); // 2/3 rounded
		});
	});

	describe("Voice Input Integration", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
			drillSystem.micButton = document.querySelector(".drill-mic-btn");
			drillSystem.inputField = document.querySelector(".drill-input");
		});

		it("should start voice recording when mic button clicked", () => {
			global.window.startRecording = vi.fn();

			drillSystem.startVoiceRecording();

			expect(drillSystem.micButton.classList.contains("recording")).toBe(true);
			expect(drillSystem.micButton.title).toBe("Stop recording");
			expect(global.window.startRecording).toHaveBeenCalled();
		});

		it("should stop voice recording", () => {
			global.window.stopRecording = vi.fn();
			drillSystem.micButton.classList.add("recording");

			drillSystem.stopVoiceRecording();

			expect(drillSystem.micButton.classList.contains("recording")).toBe(false);
			expect(drillSystem.micButton.title).toBe("Use voice input");
			expect(global.window.stopRecording).toHaveBeenCalled();
		});

		it("should handle voice input events", () => {
			global.window.startRecording = vi.fn();

			drillSystem.startVoiceRecording();

			// Simulate voice input event
			const voiceEvent = new CustomEvent("voiceInput", {
				detail: { text: "да поръчам" },
			});
			document.dispatchEvent(voiceEvent);

			expect(drillSystem.inputField.value).toBe("да поръчам");
		});

		it("should show error when voice input not available", () => {
			global.window.startRecording = undefined;
			const showNotificationSpy = vi.spyOn(drillSystem, "showNotification");

			drillSystem.startVoiceRecording();

			expect(showNotificationSpy).toHaveBeenCalledWith(
				"Voice input not available",
				"error",
			);
		});
	});

	describe("Keyboard Shortcuts", () => {
		beforeEach(() => {
			drillSystem.startPractice(mockDrills);
			drillSystem.inputField = document.querySelector(".drill-input");
		});

		it("should close practice on Escape key", () => {
			const closePracticeSpy = vi.spyOn(drillSystem, "closePractice");

			const escapeEvent = new dom.window.KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
			});

			document.dispatchEvent(escapeEvent);

			expect(closePracticeSpy).toHaveBeenCalled();
		});

		it("should check answer on Enter key", () => {
			drillSystem.inputField.value = "test answer";
			const checkAnswerSpy = vi.spyOn(drillSystem, "checkAnswer");

			const enterEvent = new dom.window.KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
			});

			document.dispatchEvent(enterEvent);

			expect(checkAnswerSpy).toHaveBeenCalled();
		});

		it("should show hint on Ctrl+H", () => {
			const showHintSpy = vi.spyOn(drillSystem, "showHint");

			const ctrlHEvent = new dom.window.KeyboardEvent("keydown", {
				key: "h",
				ctrlKey: true,
				bubbles: true,
			});

			document.dispatchEvent(ctrlHEvent);

			expect(showHintSpy).toHaveBeenCalled();
		});
	});

	describe("Utility Methods", () => {
		it("should get drills for review based on SRS", () => {
			const now = Date.now();
			drillSystem.progress.set("drill1", { nextReview: now - 1000 }); // Past due
			drillSystem.progress.set("drill2", { nextReview: now + 1000 }); // Future

			const reviewDrills = drillSystem.getDrillsForReview();

			expect(reviewDrills).toContain("drill1");
			expect(reviewDrills).not.toContain("drill2");
		});

		it("should export progress data", () => {
			drillSystem.progress.set("drill1", { attempts: 5, correct: 3 });

			const exported = drillSystem.exportProgress();

			expect(exported.progress).toHaveProperty("drill1");
			expect(exported.exportDate).toBeDefined();
			expect(exported.version).toBe("1.0");
		});

		it("should import progress data", () => {
			const importData = {
				progress: {
					drill1: { attempts: 10, correct: 8 },
				},
				version: "1.0",
			};

			drillSystem.importProgress(importData);

			expect(drillSystem.progress.has("drill1")).toBe(true);
			expect(drillSystem.progress.get("drill1").attempts).toBe(10);
		});

		it("should reset progress", () => {
			drillSystem.progress.set("drill1", { attempts: 5, correct: 3 });

			drillSystem.resetProgress();

			expect(drillSystem.progress.size).toBe(0);
			expect(localStorage.removeItem).toHaveBeenCalledWith("drillProgress");
		});
	});

	describe("Error Handling", () => {
		it("should handle localStorage errors gracefully", () => {
			localStorage.getItem.mockImplementation(() => {
				throw new Error("localStorage not available");
			});

			expect(() => drillSystem.loadProgress()).not.toThrow();
		});

		it("should handle invalid JSON in localStorage", () => {
			localStorage.getItem.mockReturnValue("invalid json");

			expect(() => drillSystem.loadProgress()).not.toThrow();
		});

		it("should handle missing elements gracefully", () => {
			// Remove elements that might not exist
			document.querySelector(".drill-hint")?.remove();

			expect(() => drillSystem.showHint()).not.toThrow();
			expect(() => drillSystem.hideHint()).not.toThrow();
		});
	});

	describe("Cleanup and Destruction", () => {
		it("should clean up properly when destroyed", () => {
			drillSystem.startPractice(mockDrills);
			const closePracticeSpy = vi.spyOn(drillSystem, "closePractice");

			drillSystem.destroy();

			expect(closePracticeSpy).toHaveBeenCalled();
			expect(drillSystem.progress.size).toBe(0);
		});
	});
});
