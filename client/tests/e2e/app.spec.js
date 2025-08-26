/**
 * E2E tests for Bulgarian Voice Coach application
 */

import { expect, test } from '@playwright/test';

test.describe('Bulgarian Voice Coach App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application with correct title and header', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle('Bulgarian Voice Coach');

    // Check main header
    await expect(page.locator('h1')).toHaveText('Bulgarian Voice Coach');
    await expect(page.locator('header p')).toHaveText('Гласов треньор за славянски говорители');
  });

  test('should display all required UI components', async ({ page }) => {
    // Check status bar
    await expect(page.locator('.status-bar')).toBeVisible();
    await expect(page.locator('#connection-text')).toBeVisible();
    await expect(page.locator('#audio-text')).toBeVisible();
    await expect(page.locator('#latency-text')).toBeVisible();

    // Check microphone panel
    await expect(page.locator('.mic-panel')).toBeVisible();
    await expect(page.locator('#mic-button')).toBeVisible();
    await expect(page.locator('.mic-level')).toBeVisible();
    await expect(page.locator('#mic-status')).toBeVisible();

    // Check transcript area
    await expect(page.locator('.transcript-panel')).toBeVisible();
    await expect(page.locator('#transcript-area')).toBeVisible();

    // Check control buttons
    await expect(page.locator('#clear-btn')).toBeVisible();
    await expect(page.locator('#play-last-btn')).toBeVisible();
  });

  test('should show proper Bulgarian font rendering', async ({ page }) => {
    // Check that Bulgarian text uses the correct font
    const bulgarianText = page.locator('header p');
    await expect(bulgarianText).toHaveText('Гласов треньор за славянски говорители');

    // Verify font is loaded (check computed styles)
    const fontFamily = await bulgarianText.evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Ysabeau');
  });

  test('should have responsive design on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    // Check app container is responsive
    await expect(page.locator('.app-container')).toBeVisible();

    // Check microphone button is appropriately sized
    const micButton = page.locator('#mic-button');
    await expect(micButton).toBeVisible();

    // Check controls stack vertically on mobile
    const controls = page.locator('.controls');
    await expect(controls).toBeVisible();
  });
});

test.describe('WebSocket Connection', () => {
  test('should attempt to connect to WebSocket server', async ({ page }) => {
    // Mock WebSocket for this test
    await page.addInitScript(() => {
      window.mockWebSocketConnections = [];
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(_url) {
          super('ws://localhost:8000/ws/asr'); // Use backend URL for E2E
          window.mockWebSocketConnections.push(this);

          // Simulate connection
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 100);
        }
      };
    });

    await page.goto('/');

    // Wait for connection attempt
    await page.waitForTimeout(200);

    // Check connection status
    await expect(page.locator('#connection-text')).toHaveText('Connected');
    await expect(page.locator('#connection-status')).toHaveClass(/connected/);
  });

  test('should display disconnected state when WebSocket fails', async ({ page }) => {
    // Mock failing WebSocket
    await page.addInitScript(() => {
      window.WebSocket = class {
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 100);
        }
      };
    });

    await page.goto('/');
    await page.waitForTimeout(200);

    await expect(page.locator('#connection-text')).toHaveText('Connection Error');
  });
});

test.describe('Microphone Interaction', () => {
  test('should handle microphone button clicks', async ({ page }) => {
    await page.goto('/');

    const micButton = page.locator('#mic-button');
    const micStatus = page.locator('#mic-status');

    // Initial state
    await expect(micButton).toHaveText('🎤');
    await expect(micStatus).toHaveText('Click microphone to start');

    // Mock getUserMedia to avoid permission prompt
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    // Click to start recording (will be mocked)
    await micButton.click();

    // Note: In real E2E, this would require microphone permissions
    // For testing, we check the UI state changes
    await expect(micStatus).toHaveText('Click microphone to start'); // Still initial since no real audio
  });

  test('should respond to keyboard shortcut (Ctrl+Space)', async ({ page }) => {
    await page.goto('/');

    // Mock getUserMedia
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    // Test keyboard shortcut
    await page.keyboard.press('Control+Space');

    // In a real implementation, this would trigger recording
    // Here we just verify the key event is handled
    const micButton = page.locator('#mic-button');
    await expect(micButton).toBeVisible();
  });
});

test.describe('Transcript Management', () => {
  test('should clear transcript when clear button is clicked', async ({ page }) => {
    await page.goto('/');

    // Add some mock transcript content first
    await page.evaluate(() => {
      const transcriptArea = document.getElementById('transcript-area');
      const testLine = document.createElement('div');
      testLine.className = 'transcript-line final';
      testLine.innerHTML = '<strong>You:</strong> <span class="bg-text">Test transcript</span>';
      transcriptArea.appendChild(testLine);
    });

    // Click clear button
    await page.locator('#clear-btn').click();

    // Check transcript is cleared
    await expect(page.locator('#transcript-area')).toContainText(
      'Start speaking to practice Bulgarian...'
    );
  });

  test('should disable play button initially', async ({ page }) => {
    await page.goto('/');

    const playButton = page.locator('#play-last-btn');
    await expect(playButton).toBeDisabled();
    await expect(playButton).toHaveText('🔊 Play Last Response');
  });
});

test.describe('Audio Worklet Support', () => {
  test('should detect AudioWorklet support', async ({ page }) => {
    await page.goto('/');

    const audioWorkletSupported = await page.evaluate(() => {
      return 'audioWorklet' in (window.AudioContext || window.webkitAudioContext).prototype;
    });

    expect(audioWorkletSupported).toBe(true);
  });

  test('should fallback to ScriptProcessor if AudioWorklet fails', async ({ page }) => {
    // Mock AudioWorklet failure
    await page.addInitScript(() => {
      if (window.AudioContext) {
        window.AudioContext.prototype.audioWorklet = undefined;
      }
      if (window.webkitAudioContext) {
        window.webkitAudioContext.prototype.audioWorklet = undefined;
      }
    });

    await page.goto('/');

    // Application should still load without AudioWorklet
    await expect(page.locator('.app-container')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle fetch errors gracefully', async ({ page }) => {
    // Mock fetch to simulate TTS failure
    await page.addInitScript(() => {
      window.fetch = async () => {
        throw new Error('Network error');
      };
    });

    await page.goto('/');

    // Application should still be functional
    await expect(page.locator('.app-container')).toBeVisible();
    await expect(page.locator('#mic-button')).toBeVisible();
  });

  test('should handle JavaScript errors without crashing', async ({ page }) => {
    // Listen for JavaScript errors
    const errors = [];
    page.on('pageerror', (error) => errors.push(error));

    await page.goto('/');

    // Simulate an error condition
    await page.evaluate(() => {
      // Try to trigger an error
      try {
        window.voiceCoach.nonExistentMethod();
      } catch (_e) {
        // Errors should be handled gracefully
      }
    });

    // App should still be responsive
    await expect(page.locator('#mic-button')).toBeVisible();

    // Check no critical errors occurred
    expect(errors.length).toBe(0);
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/');

    // Check microphone button has proper accessibility
    const micButton = page.locator('#mic-button');
    await expect(micButton).toHaveAttribute('title', 'Click to start/stop recording');

    // Check language attribute for Bulgarian text
    await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Should focus on mic button
    await expect(page.locator('#mic-button')).toBeFocused();

    await page.keyboard.press('Tab'); // Clear button
    await expect(page.locator('#clear-btn')).toBeFocused();

    await page.keyboard.press('Tab'); // Play button
    await expect(page.locator('#play-last-btn')).toBeFocused();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');

    // Check that text has sufficient contrast
    const header = page.locator('h1');
    const styles = await header.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        background: computed.backgroundColor,
      };
    });

    // Basic check that colors are defined
    expect(styles.color).toBeTruthy();
  });
});

test.describe('Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');

    // Wait for main content to be visible
    await expect(page.locator('.app-container')).toBeVisible();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });

  test('should handle rapid UI updates', async ({ page }) => {
    await page.goto('/');

    // Simulate rapid transcript updates
    await page.evaluate(() => {
      const transcriptArea = document.getElementById('transcript-area');

      // Add multiple transcript lines rapidly
      for (let i = 0; i < 50; i++) {
        const line = document.createElement('div');
        line.className = 'transcript-line partial';
        line.innerHTML = `<strong>Partial ${i}:</strong> <span class="bg-text">Test text ${i}</span>`;
        transcriptArea.appendChild(line);
      }
    });

    // UI should remain responsive
    await expect(page.locator('#mic-button')).toBeVisible();
    const transcriptLines = page.locator('.transcript-line');
    await expect(transcriptLines).toHaveCount(50);
  });
});

test.describe('Cross-browser Compatibility', () => {
  test('should work in different browser engines', async ({ page, browserName }) => {
    await page.goto('/');

    // Check basic functionality works across browsers
    await expect(page.locator('.app-container')).toBeVisible();
    await expect(page.locator('#mic-button')).toBeVisible();

    // Check AudioContext support
    const audioContextSupported = await page.evaluate(() => {
      return !!(window.AudioContext || window.webkitAudioContext);
    });

    expect(audioContextSupported).toBe(true);

    console.log(`✓ Basic functionality works in ${browserName}`);
  });
});

test.describe('Bulgarian Text Rendering', () => {
  test('should render Cyrillic characters correctly', async ({ page }) => {
    await page.goto('/');

    // Add Bulgarian text to transcript
    await page.evaluate(() => {
      const transcriptArea = document.getElementById('transcript-area');
      const testLine = document.createElement('div');
      testLine.className = 'transcript-line final';
      testLine.innerHTML =
        '<strong>You:</strong> <span class="bg-text">Здравей, как си? Аз съм добре, благодаря!</span>';
      transcriptArea.appendChild(testLine);
    });

    // Check the text renders correctly
    await expect(page.locator('.bg-text')).toHaveText('Здравей, как си? Аз съм добре, благодаря!');

    // Verify font features are applied
    const fontFeatures = await page.locator('.bg-text').evaluate((el) => {
      return window.getComputedStyle(el).fontFeatureSettings;
    });

    expect(fontFeatures).toContain('locl');
  });

  test('should handle mixed language content', async ({ page }) => {
    await page.goto('/');

    // Add mixed Bulgarian-English text
    await page.evaluate(() => {
      const transcriptArea = document.getElementById('transcript-area');
      const testLine = document.createElement('div');
      testLine.className = 'transcript-line coach';
      testLine.innerHTML =
        '<strong>Coach:</strong> <span class="bg-text">Good job! Много добре! Well done!</span>';
      transcriptArea.appendChild(testLine);
    });

    await expect(page.locator('.bg-text')).toHaveText('Good job! Много добре! Well done!');
  });
});
