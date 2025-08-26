/**
 * Performance and stress E2E tests for Bulgarian Voice Coach
 */

import { expect, test } from "@playwright/test";

test.describe("Performance E2E Tests", () => {
	test("should handle rapid microphone button clicks", async ({ page }) => {
		await page.addInitScript(() => {
			const _clickCount = 0;

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [
					{
						stop: () => {},
						kind: "audio",
						enabled: true,
					},
				],
			});

			window.WebSocket = class MockWebSocket {
				constructor() {
					this.readyState = WebSocket.OPEN;
					this.onopen = null;
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event("open"));
					}, 50);
				}
				send() {}
			};
		});

		await page.goto("/");
		const micButton = page.locator("#mic-button");

		// Rapid clicking test (should not break the app)
		for (let i = 0; i < 10; i++) {
			await micButton.click();
			await page.waitForTimeout(50);
		}

		// Should still be functional
		await expect(micButton).toBeVisible();
		await expect(page.locator("#mic-status")).toContainText(
			/Click microphone|Recording/,
		);
	});

	test("should handle long recording sessions", async ({ page }) => {
		await page.addInitScript(() => {
			let messageCount = 0;

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});

			window.WebSocket = class MockWebSocket {
				constructor() {
					this.readyState = WebSocket.OPEN;
					this.onopen = null;
					this.onmessage = null;
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event("open"));
					}, 50);
				}

				send(data) {
					if (data.includes("start_recording")) {
						// Simulate long recording with many partial results
						const sendPartials = () => {
							if (this.onmessage && messageCount < 100) {
								this.onmessage(
									new MessageEvent("message", {
										data: JSON.stringify({
											type: "transcription",
											text: `Partial result ${messageCount}`,
											is_final: false,
										}),
									}),
								);
								messageCount++;
								setTimeout(sendPartials, 100);
							}
						};
						setTimeout(sendPartials, 100);
					}
				}
			};
		});

		await page.goto("/");

		// Start long recording session
		await page.locator("#mic-button").click();

		// Let it run for several seconds
		await page.waitForTimeout(5000);

		// Stop recording
		await page.locator("#mic-button").click();

		// Should still be responsive
		await expect(page.locator("#mic-button")).toBeVisible();
		await expect(page.locator("#mic-status")).toHaveText(
			"Click microphone to start",
		);
	});

	test("should handle memory stress with many transcript entries", async ({
		page,
	}) => {
		await page.goto("/");

		// Add many transcript entries to test memory handling
		await page.evaluate(() => {
			const transcriptArea = document.getElementById("transcript-area");

			for (let i = 0; i < 1000; i++) {
				const line = document.createElement("div");
				line.className =
					i % 2 === 0 ? "transcript-line final" : "transcript-line coach";
				line.innerHTML = `<strong>${i % 2 === 0 ? "You" : "Coach"}:</strong> <span class="bg-text">Test entry ${i} with Bulgarian text: Здравей номер ${i}</span>`;
				transcriptArea.appendChild(line);
			}
		});

		// Check that UI remains responsive
		await expect(page.locator(".transcript-line")).toHaveCount(1000, {
			timeout: 10000,
		});

		// Clear should still work
		await page.locator("#clear-btn").click();
		await expect(page.locator(".transcript-line")).toHaveCount(0);
		await expect(page.locator("#transcript-area")).toContainText(
			"Start speaking",
		);
	});

	test("should handle WebSocket message flooding", async ({ page }) => {
		await page.addInitScript(() => {
			window.WebSocket = class MockWebSocket {
				constructor() {
					this.readyState = WebSocket.OPEN;
					this.onopen = null;
					this.onmessage = null;
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event("open"));
					}, 50);
				}

				send(_data) {
					// Flood with messages
					setTimeout(() => {
						for (let i = 0; i < 50; i++) {
							if (this.onmessage) {
								this.onmessage(
									new MessageEvent("message", {
										data: JSON.stringify({
											type: "transcription",
											text: `Flood message ${i}: Много текст тук`,
											is_final: i === 49,
										}),
									}),
								);
							}
						}
					}, 100);
				}
			};

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});
		});

		await page.goto("/");
		await page.locator("#mic-button").click();
		await page.locator("#mic-button").click();

		// Should handle the flood gracefully
		await page.waitForTimeout(2000);
		await expect(page.locator("#mic-button")).toBeVisible();

		// Final message should be displayed
		await expect(page.locator(".transcript-line.final")).toContainText(
			"Flood message 49",
		);
	});

	test("should maintain performance during visual updates", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			// Mock continuous level updates
			window.WebSocket = class MockWebSocket {
				constructor() {
					this.readyState = WebSocket.OPEN;
					this.onopen = null;
					this.onmessage = null;
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event("open"));
					}, 50);
				}

				send(data) {
					if (data.includes("start_recording")) {
						// Send continuous level updates
						const sendLevels = () => {
							if (this.onmessage) {
								this.onmessage(
									new MessageEvent("message", {
										data: JSON.stringify({
											type: "audio_level",
											level: Math.random(),
										}),
									}),
								);
								setTimeout(sendLevels, 16); // ~60fps
							}
						};
						sendLevels();
					}
				}
			};

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});
		});

		await page.goto("/");

		const startTime = Date.now();
		await page.locator("#mic-button").click();

		// Let visual updates run
		await page.waitForTimeout(3000);

		await page.locator("#mic-button").click();
		const endTime = Date.now();

		// Should complete within reasonable time despite heavy updates
		expect(endTime - startTime).toBeLessThan(5000);
		await expect(page.locator("#mic-button")).toBeVisible();
	});
});

test.describe("Accessibility E2E Tests", () => {
	test("should support keyboard-only navigation", async ({ page }) => {
		await page.addInitScript(() => {
			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});
		});

		await page.goto("/");

		// Use only keyboard navigation
		await page.keyboard.press("Tab"); // Focus mic button
		await expect(page.locator("#mic-button")).toBeFocused();

		await page.keyboard.press("Enter"); // Activate mic
		await page.waitForTimeout(500);

		await page.keyboard.press("Tab"); // Focus clear button
		await expect(page.locator("#clear-btn")).toBeFocused();

		await page.keyboard.press("Tab"); // Focus play button
		await expect(page.locator("#play-last-btn")).toBeFocused();

		// Ctrl+Space should work from any focus
		await page.keyboard.press("Control+Space");
		await page.waitForTimeout(100);
	});

	test("should provide proper screen reader support", async ({ page }) => {
		await page.goto("/");

		// Check ARIA labels and roles
		const micButton = page.locator("#mic-button");
		await expect(micButton).toHaveAttribute(
			"title",
			"Click to start/stop recording",
		);

		// Check status updates are announced
		const micStatus = page.locator("#mic-status");
		await expect(micStatus).toHaveAttribute("aria-live", "polite");

		// Check connection status
		const connectionStatus = page.locator("#connection-text");
		await expect(connectionStatus).toBeVisible();

		// Test high contrast mode compatibility
		await page.emulateMedia({ colorScheme: "dark" });
		await expect(micButton).toBeVisible();

		await page.emulateMedia({ colorScheme: "light" });
		await expect(micButton).toBeVisible();
	});

	test("should work with reduced motion preferences", async ({ page }) => {
		// Simulate reduced motion preference
		await page.addInitScript(() => {
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: (query) => ({
					matches: query.includes("prefers-reduced-motion"),
					addListener: () => {},
					removeListener: () => {},
				}),
			});
		});

		await page.goto("/");

		// App should still be fully functional
		await expect(page.locator("#mic-button")).toBeVisible();
		await expect(page.locator(".transcript-panel")).toBeVisible();

		// Animations should be reduced/disabled
		const styles = await page.evaluate(() => {
			const computed = getComputedStyle(document.querySelector("#mic-button"));
			return {
				transition: computed.transition,
				animation: computed.animation,
			};
		});

		// With reduced motion, transitions should be minimal or none
		expect(styles.transition).not.toContain("transform");
	});
});

test.describe("Edge Case E2E Tests", () => {
	test("should handle invalid WebSocket messages", async ({ page }) => {
		await page.addInitScript(() => {
			window.WebSocket = class MockWebSocket {
				constructor() {
					this.readyState = WebSocket.OPEN;
					this.onopen = null;
					this.onmessage = null;
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event("open"));
					}, 50);
				}

				send(_data) {
					setTimeout(() => {
						if (this.onmessage) {
							// Send invalid JSON
							this.onmessage(
								new MessageEvent("message", {
									data: "invalid json {",
								}),
							);

							// Send valid message after
							setTimeout(() => {
								this.onmessage(
									new MessageEvent("message", {
										data: JSON.stringify({
											type: "transcription",
											text: "Valid message after invalid",
											is_final: true,
										}),
									}),
								);
							}, 100);
						}
					}, 100);
				}
			};

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});
		});

		await page.goto("/");
		await page.locator("#mic-button").click();
		await page.locator("#mic-button").click();

		// Should handle invalid message gracefully and continue working
		await expect(page.locator(".transcript-line.final")).toContainText(
			"Valid message after invalid",
			{ timeout: 3000 },
		);
	});

	test("should handle extremely long text inputs", async ({ page }) => {
		await page.addInitScript(() => {
			const longText = "Много дълъг български текст ".repeat(1000);

			window.WebSocket = class MockWebSocket {
				constructor() {
					this.readyState = WebSocket.OPEN;
					this.onopen = null;
					this.onmessage = null;
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event("open"));
					}, 50);
				}

				send(_data) {
					setTimeout(() => {
						if (this.onmessage) {
							this.onmessage(
								new MessageEvent("message", {
									data: JSON.stringify({
										type: "transcription",
										text: longText,
										is_final: true,
									}),
								}),
							);
						}
					}, 100);
				}
			};

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});
		});

		await page.goto("/");
		await page.locator("#mic-button").click();
		await page.locator("#mic-button").click();

		// Should handle very long text without breaking
		await expect(page.locator(".transcript-line.final")).toBeVisible({
			timeout: 3000,
		});

		// UI should still be responsive
		await expect(page.locator("#clear-btn")).toBeVisible();
		await page.locator("#clear-btn").click();
		await expect(page.locator("#transcript-area")).toContainText(
			"Start speaking",
		);
	});

	test("should recover from audio context suspension", async ({ page }) => {
		await page.addInitScript(() => {
			window.AudioContext = class MockAudioContext {
				constructor() {
					this.state = "suspended";
					this.sampleRate = 48000;
					this.audioWorklet = {
						addModule: async () => {},
					};
				}

				async resume() {
					// Simulate failure then success
					if (this.resumeAttempts === undefined) {
						this.resumeAttempts = 0;
					}
					this.resumeAttempts++;

					if (this.resumeAttempts === 1) {
						throw new Error("AudioContext resume failed");
					}
					this.state = "running";
				}

				createMediaStreamSource() {
					return { connect: () => {} };
				}
			};

			navigator.mediaDevices.getUserMedia = async () => ({
				getTracks: () => [{ stop: () => {} }],
			});
		});

		await page.goto("/");

		// First attempt should fail, second should succeed
		await page.locator("#mic-button").click();

		// Should retry and eventually work
		await expect(page.locator("#mic-status")).toHaveText("Recording...", {
			timeout: 5000,
		});
	});
});
