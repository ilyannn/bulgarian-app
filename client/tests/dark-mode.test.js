/**
 * Tests for Dark Mode System
 */

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DarkModeSystem } from "../dark-mode.js";

// Mock DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Test</title></head>
    <body>
      <div class="header">
        <h1>Bulgarian Voice Coach</h1>
        <p>Test subtitle</p>
      </div>
      <div class="app-container">
        <div class="mic-panel">
          <button class="mic-button">🎤</button>
        </div>
        <div class="transcript-area"></div>
      </div>
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

// Mock window.matchMedia
global.window.matchMedia = vi.fn();

describe("DarkModeSystem", () => {
	let darkModeSystem;
	let mockMatchMedia;

	beforeEach(() => {
		// Reset DOM
		document.documentElement.removeAttribute("data-theme");
		document.body.innerHTML = `
      <div class="header">
        <h1>Bulgarian Voice Coach</h1>
        <p>Test subtitle</p>
      </div>
      <div class="app-container">
        <div class="mic-panel">
          <button class="mic-button">🎤</button>
        </div>
        <div class="transcript-area"></div>
      </div>
    `;

		// Reset localStorage mocks
		vi.clearAllMocks();
		localStorage.getItem.mockReturnValue(null);

		// Mock console.log to reduce test noise
		vi.spyOn(console, "log").mockImplementation(() => {});

		// Reset matchMedia mock
		mockMatchMedia = {
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};

		// Create a fresh matchMedia mock function for each test
		window.matchMedia = vi.fn().mockReturnValue(mockMatchMedia);

		// Create fresh instance
		darkModeSystem = new DarkModeSystem();
	});

	afterEach(() => {
		// Clean up styles
		for (const style of document.head.querySelectorAll("style")) {
			style.remove();
		}
		for (const meta of document.head.querySelectorAll(
			'meta[name="theme-color"]',
		)) {
			meta.remove();
		}

		// Restore console.log
		vi.restoreAllMocks();
	});

	describe("Initialization", () => {
		it("should initialize with correct default properties", () => {
			expect(darkModeSystem.isDarkMode).toBe(false);
			expect(darkModeSystem.toggleButton).not.toBeNull();
			expect(darkModeSystem.themeIcon).not.toBeNull();
		});

		it("should create toggle button in header", () => {
			const toggleContainer = document.querySelector(".theme-toggle-container");
			const toggleButton = document.querySelector(".theme-toggle-btn");
			const themeIcon = document.querySelector(".theme-icon");

			expect(toggleContainer).not.toBeNull();
			expect(toggleButton).not.toBeNull();
			expect(themeIcon).not.toBeNull();
			expect(themeIcon.textContent).toBe("🌙"); // Light mode icon
		});

		it("should inject styles into document head", () => {
			const styleSheets = document.head.querySelectorAll("style");
			expect(styleSheets.length).toBeGreaterThan(0);

			const styles = styleSheets[styleSheets.length - 1].textContent;
			expect(styles).toContain(".theme-toggle-btn");
			expect(styles).toContain('[data-theme="dark"]');
		});

		it("should setup keyboard event listener", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener");
			new DarkModeSystem();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"keydown",
				expect.any(Function),
			);
		});
	});

	describe("Theme Preference Management", () => {
		it("should get system preference when no stored preference", () => {
			mockMatchMedia.matches = true;
			const newSystem = new DarkModeSystem();

			expect(newSystem.getSystemPreference()).toBe(true);
		});

		it("should use stored preference when available", () => {
			localStorage.getItem.mockReturnValue("true");
			const newSystem = new DarkModeSystem();

			expect(newSystem.isDarkMode).toBe(true);
			expect(localStorage.getItem).toHaveBeenCalledWith("dark-mode-preference");
		});

		it("should handle localStorage errors gracefully", () => {
			localStorage.getItem.mockImplementation(() => {
				throw new Error("localStorage not available");
			});

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const newSystem = new DarkModeSystem();

			expect(consoleSpy).toHaveBeenCalled();
			expect(newSystem.getStoredPreference()).toBe(false); // Should fallback to system

			consoleSpy.mockRestore();
		});

		it("should check if user has stored preference", () => {
			localStorage.getItem.mockReturnValue("true");
			expect(darkModeSystem.hasStoredPreference()).toBe(true);

			localStorage.getItem.mockReturnValue(null);
			expect(darkModeSystem.hasStoredPreference()).toBe(false);
		});

		it("should store preference in localStorage", () => {
			darkModeSystem.storePreference(true);
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"dark-mode-preference",
				"true",
			);

			darkModeSystem.storePreference(false);
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"dark-mode-preference",
				"false",
			);
		});

		it("should handle localStorage store errors", () => {
			localStorage.setItem.mockImplementation(() => {
				throw new Error("localStorage not available");
			});

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			darkModeSystem.storePreference(true);

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("Theme Application", () => {
		it("should apply dark theme correctly", () => {
			darkModeSystem.applyTheme(true, false);

			expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		});

		it("should apply light theme correctly", () => {
			// First set dark theme
			darkModeSystem.applyTheme(true, false);
			expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

			// Then set light theme
			darkModeSystem.applyTheme(false, false);
			expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		});

		it("should dispatch theme change event", () => {
			let eventDetail = null;
			document.addEventListener("themechange", (event) => {
				eventDetail = event.detail;
			});

			darkModeSystem.applyTheme(true, false);

			expect(eventDetail).toEqual({
				isDark: true,
				theme: "dark",
			});
		});

		it("should update meta theme-color", () => {
			darkModeSystem.applyTheme(true, false);

			const metaThemeColor = document.querySelector('meta[name="theme-color"]');
			expect(metaThemeColor).not.toBeNull();
			expect(metaThemeColor.content).toBe("#1a1a2e");

			darkModeSystem.applyTheme(false, false);
			expect(metaThemeColor.content).toBe("#667eea");
		});
	});

	describe("Theme Toggle", () => {
		it("should toggle theme when button clicked", () => {
			expect(darkModeSystem.isDarkMode).toBe(false);

			darkModeSystem.toggleButton.click();

			expect(darkModeSystem.isDarkMode).toBe(true);
			expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"dark-mode-preference",
				"true",
			);
		});

		it("should update toggle icon when theme changes", () => {
			expect(darkModeSystem.themeIcon.textContent).toBe("🌙");

			darkModeSystem.toggleTheme();

			expect(darkModeSystem.themeIcon.textContent).toBe("☀️");
			expect(darkModeSystem.toggleButton.title).toContain("light mode");
		});

		it("should handle keyboard shortcut (Ctrl+D)", () => {
			const toggleSpy = vi.spyOn(darkModeSystem, "toggleTheme");

			const event = new dom.window.KeyboardEvent("keydown", {
				key: "d",
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

		it("should handle keyboard shortcut (Cmd+D)", () => {
			const toggleSpy = vi.spyOn(darkModeSystem, "toggleTheme");

			const event = new dom.window.KeyboardEvent("keydown", {
				key: "d",
				metaKey: true,
				bubbles: true,
			});

			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
			});

			document.dispatchEvent(event);

			expect(event.preventDefault).toHaveBeenCalled();
			expect(toggleSpy).toHaveBeenCalled();
		});

		it("should not trigger on other key combinations", () => {
			const toggleSpy = vi.spyOn(darkModeSystem, "toggleTheme");

			const event = new dom.window.KeyboardEvent("keydown", {
				key: "d",
				shiftKey: true,
				bubbles: true,
			});

			document.dispatchEvent(event);

			expect(toggleSpy).not.toHaveBeenCalled();
		});
	});

	describe("System Theme Integration", () => {
		it("should watch for system theme changes", () => {
			expect(window.matchMedia).toHaveBeenCalledWith(
				"(prefers-color-scheme: dark)",
			);
			expect(mockMatchMedia.addEventListener).toHaveBeenCalledWith(
				"change",
				expect.any(Function),
			);
		});

		it("should respond to system theme changes when no stored preference", () => {
			darkModeSystem.hasStoredPreference = vi.fn(() => false);

			// Simulate system theme change to dark
			const changeHandler = mockMatchMedia.addEventListener.mock.calls.find(
				(call) => call[0] === "change",
			)[1];

			changeHandler({ matches: true });

			expect(darkModeSystem.isDarkMode).toBe(true);
			expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		});

		it("should not respond to system theme changes when user has stored preference", () => {
			darkModeSystem.hasStoredPreference = vi.fn(() => true);
			const originalTheme = darkModeSystem.isDarkMode;

			const changeHandler = mockMatchMedia.addEventListener.mock.calls.find(
				(call) => call[0] === "change",
			)[1];

			changeHandler({ matches: !originalTheme });

			expect(darkModeSystem.isDarkMode).toBe(originalTheme); // Should not change
		});
	});

	describe("Cross-Tab Synchronization", () => {
		it("should listen for storage changes", () => {
			const addEventListenerSpy = vi.spyOn(window, "addEventListener");
			new DarkModeSystem();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"storage",
				expect.any(Function),
			);
		});

		it("should sync theme across tabs when storage changes", () => {
			const applyThemeSpy = vi.spyOn(darkModeSystem, "applyTheme");
			const updateIconSpy = vi.spyOn(darkModeSystem, "updateToggleIcon");

			// Simulate storage event from another tab
			const storageEvent = new dom.window.StorageEvent("storage", {
				key: "dark-mode-preference",
				newValue: "true",
			});

			window.dispatchEvent(storageEvent);

			expect(darkModeSystem.isDarkMode).toBe(true);
			expect(applyThemeSpy).toHaveBeenCalledWith(true, false);
			expect(updateIconSpy).toHaveBeenCalled();
		});

		it("should ignore storage changes for other keys", () => {
			const originalTheme = darkModeSystem.isDarkMode;

			const storageEvent = new dom.window.StorageEvent("storage", {
				key: "other-setting",
				newValue: "value",
			});

			window.dispatchEvent(storageEvent);

			expect(darkModeSystem.isDarkMode).toBe(originalTheme);
		});
	});

	describe("Notification System", () => {
		it("should show notification using window.showToast if available", () => {
			const mockShowToast = vi.fn();
			window.showToast = mockShowToast;

			darkModeSystem.showNotification("Test message", "info");

			expect(mockShowToast).toHaveBeenCalledWith("Test message", "info");
		});

		it("should fallback to enhanced corrections notification", () => {
			window.showToast = undefined;
			const mockEnhancedCorrections = {
				showNotification: vi.fn(),
			};
			window.enhancedCorrections = mockEnhancedCorrections;

			darkModeSystem.showNotification("Test message", "error");

			expect(mockEnhancedCorrections.showNotification).toHaveBeenCalledWith(
				"Test message",
				"error",
			);
		});

		it("should fallback to console.log if no notification system", () => {
			window.showToast = undefined;
			window.enhancedCorrections = undefined;

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			darkModeSystem.showNotification("Test message");

			expect(consoleSpy).toHaveBeenCalledWith("Theme: Test message");

			consoleSpy.mockRestore();
		});
	});

	describe("Theme Information", () => {
		it("should return correct theme information", () => {
			localStorage.getItem.mockReturnValue("true");
			mockMatchMedia.matches = true;

			const info = darkModeSystem.getThemeInfo();

			expect(info).toEqual({
				isDarkMode: darkModeSystem.isDarkMode,
				theme: darkModeSystem.isDarkMode ? "dark" : "light",
				hasStoredPreference: true,
				systemPreference: true,
				supportsSystemDetection: true,
			});
		});

		it("should handle missing matchMedia support", () => {
			window.matchMedia = undefined;

			const info = darkModeSystem.getThemeInfo();

			expect(info.supportsSystemDetection).toBe(false);
		});
	});

	describe("Advanced Theme Management", () => {
		it("should force theme without storing preference", () => {
			const storePreferenceSpy = vi.spyOn(darkModeSystem, "storePreference");

			darkModeSystem.forceTheme(true);

			expect(darkModeSystem.isDarkMode).toBe(true);
			expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
			expect(storePreferenceSpy).not.toHaveBeenCalled();
		});

		it("should reset to system preference", () => {
			mockMatchMedia.matches = true; // System prefers dark
			localStorage.getItem.mockReturnValue("false"); // User stored light preference

			darkModeSystem.resetToSystemPreference();

			expect(darkModeSystem.isDarkMode).toBe(true); // Should match system
			expect(localStorage.removeItem).toHaveBeenCalledWith(
				"dark-mode-preference",
			);
		});

		it("should handle localStorage remove errors in reset", () => {
			localStorage.removeItem.mockImplementation(() => {
				throw new Error("localStorage not available");
			});

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			darkModeSystem.resetToSystemPreference();

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("Analytics and Tracking", () => {
		it("should track theme changes", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			darkModeSystem.toggleTheme();

			expect(consoleSpy).toHaveBeenCalledWith(
				"Theme change tracked:",
				expect.objectContaining({
					action: "theme_change",
					theme: "dark",
					timestamp: expect.any(Number),
				}),
			);

			consoleSpy.mockRestore();
		});

		it("should detect mobile user agent in tracking", () => {
			const originalUserAgent = navigator.userAgent;
			Object.defineProperty(navigator, "userAgent", {
				value:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
				configurable: true,
			});

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			darkModeSystem.trackThemeChange();

			expect(consoleSpy).toHaveBeenCalledWith(
				"Theme change tracked:",
				expect.objectContaining({
					userAgent: "mobile",
				}),
			);

			// Restore original user agent
			Object.defineProperty(navigator, "userAgent", {
				value: originalUserAgent,
				configurable: true,
			});

			consoleSpy.mockRestore();
		});
	});

	describe("Cleanup and Destruction", () => {
		it("should clean up properly when destroyed", () => {
			const toggleButton = darkModeSystem.toggleButton;
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			darkModeSystem.destroy();

			expect(document.contains(toggleButton)).toBe(false);
			expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith("DarkModeSystem destroyed");

			consoleSpy.mockRestore();
		});
	});

	describe("Edge Cases", () => {
		it("should handle missing header gracefully", () => {
			document.querySelector(".header")?.remove();

			const newSystem = new DarkModeSystem();

			expect(newSystem.toggleButton).toBeNull();
			expect(newSystem.themeIcon).toBeNull();
		});

		it("should handle theme application with animation", () => {
			const iconSpy = vi.spyOn(darkModeSystem.themeIcon.classList, "add");
			const removeIconSpy = vi.spyOn(
				darkModeSystem.themeIcon.classList,
				"remove",
			);

			darkModeSystem.applyTheme(true, true);

			expect(iconSpy).toHaveBeenCalledWith("switching");

			// Simulate timeout completion
			setTimeout(() => {
				expect(removeIconSpy).toHaveBeenCalledWith("switching");
			}, 500);
		});

		it("should handle missing matchMedia in system detection", () => {
			window.matchMedia = undefined;

			expect(darkModeSystem.getSystemPreference()).toBe(false);
		});
	});
});
