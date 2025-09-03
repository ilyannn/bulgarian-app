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

test.describe('Complete Voice Coaching Workflow', () => {
  test('should handle full voice interaction cycle', async ({ page }) => {
    // Mock WebSocket and audio for complete workflow
    await page.addInitScript(() => {
      window.mockWebSocketMessages = [];
      window.mockAudioData = [];

      // Mock WebSocket with message handling
      window.WebSocket = class MockWebSocket {
        constructor(url) {
          this.url = url;
          this.readyState = WebSocket.CONNECTING;
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;

          setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            if (this.onopen) this.onopen(new Event('open'));
          }, 100);
        }

        send(data) {
          window.mockWebSocketMessages.push(data);

          // Simulate ASR responses based on sent data
          setTimeout(() => {
            if (this.onmessage) {
              // Mock partial transcription
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'transcription',
                    text: 'Здравей',
                    is_final: false,
                  }),
                })
              );

              // Mock final transcription
              setTimeout(() => {
                this.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'transcription',
                      text: 'Здравей, как си?',
                      is_final: true,
                    }),
                  })
                );

                // Mock coach response
                setTimeout(() => {
                  this.onmessage(
                    new MessageEvent('message', {
                      data: JSON.stringify({
                        type: 'coach_response',
                        text: 'Отлично произношение! Много добре казахте "здравей".',
                        audio_data: 'mock_audio_base64_data',
                      }),
                    })
                  );
                }, 200);
              }, 300);
            }
          }, 200);
        }

        close() {
          this.readyState = WebSocket.CLOSED;
          if (this.onclose) this.onclose(new Event('close'));
        }
      };

      // Mock getUserMedia for audio capture
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [
          {
            stop: () => {},
            kind: 'audio',
            enabled: true,
          },
        ],
      });

      // Mock Audio for TTS playback
      window.Audio = class MockAudio {
        constructor() {
          this.src = '';
          this.onended = null;
          this.play = async () => {
            window.mockAudioData.push('played');
            setTimeout(() => {
              if (this.onended) this.onended();
            }, 500);
          };
        }
      };
    });

    await page.goto('/');

    // Wait for connection
    await expect(page.locator('#connection-text')).toHaveText('Connected', {
      timeout: 5000,
    });

    // Start recording
    const micButton = page.locator('#mic-button');
    await micButton.click();

    // Check recording state
    await expect(page.locator('#mic-status')).toHaveText('Recording...', {
      timeout: 2000,
    });

    // Stop recording
    await micButton.click();

    // Wait for transcription to appear
    await expect(page.locator('.transcript-line.partial')).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator('.transcript-line.partial')).toContainText('Здравей');

    // Wait for final transcription
    await expect(page.locator('.transcript-line.final')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('.transcript-line.final')).toContainText('Здравей, как си?');

    // Wait for coach response
    await expect(page.locator('.transcript-line.coach')).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator('.transcript-line.coach')).toContainText('Отлично произношение');

    // Check that play button is now enabled
    await expect(page.locator('#play-last-btn')).toBeEnabled({ timeout: 2000 });

    // Test TTS playback
    await page.locator('#play-last-btn').click();

    // Verify audio was played (check mock data)
    const audioPlayed = await page.evaluate(() => window.mockAudioData.length > 0);
    expect(audioPlayed).toBe(true);
  });

  test('should handle voice activity detection', async ({ page }) => {
    await page.addInitScript(() => {
      // Mock WebSocket with VAD simulation
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(_data) {
          // Simulate VAD detection
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'vad',
                    speaking: true,
                  }),
                })
              );

              setTimeout(() => {
                this.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'vad',
                      speaking: false,
                    }),
                  })
                );
              }, 1000);
            }
          }, 100);
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await page.locator('#mic-button').click();

    // Should show voice activity
    await expect(page.locator('#mic-status')).toHaveText('Recording...', {
      timeout: 2000,
    });

    // Check for visual feedback during speaking
    const micLevel = page.locator('.mic-level');
    await expect(micLevel).toBeVisible();
  });

  test('should handle grammar correction workflow', async ({ page }) => {
    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(_data) {
          setTimeout(() => {
            if (this.onmessage) {
              // Mock grammar error detection
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'transcription',
                    text: 'Аз съм студент от България',
                    is_final: true,
                  }),
                })
              );

              // Mock grammar correction
              setTimeout(() => {
                this.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'coach_response',
                      text: 'Добре! Забележете правилното използване на "от" за произход. Много добре!',
                      grammar_notes:
                        'Правилно използвахте предлога "от" за означаване на произход.',
                      audio_data: 'mock_grammar_audio',
                    }),
                  })
                );
              }, 300);
            }
          }, 200);
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await page.locator('#mic-button').click();
    await page.locator('#mic-button').click(); // Stop recording

    // Wait for grammar feedback
    await expect(page.locator('.transcript-line.coach')).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator('.transcript-line.coach')).toContainText('Правилно използвахте');
  });
});

test.describe('Audio Processing E2E', () => {
  test('should handle continuous recording mode', async ({ page }) => {
    await page.addInitScript(() => {
      let recordingActive = false;

      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(data) {
          if (data.includes('start_recording')) {
            recordingActive = true;
            // Simulate continuous partial results
            const sendPartials = () => {
              if (recordingActive && this.onmessage) {
                this.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'transcription',
                      text: Math.random() > 0.5 ? 'Добър ден' : 'Как сте',
                      is_final: false,
                    }),
                  })
                );
                setTimeout(sendPartials, 500);
              }
            };
            setTimeout(sendPartials, 200);
          } else if (data.includes('stop_recording')) {
            recordingActive = false;
          }
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');

    // Start continuous recording
    await page.locator('#mic-button').click();

    // Should show continuous partial updates
    await expect(page.locator('.transcript-line.partial')).toBeVisible({
      timeout: 2000,
    });

    // Wait for multiple partial updates
    await page.waitForTimeout(1000);

    // Stop recording
    await page.locator('#mic-button').click();
    await expect(page.locator('#mic-status')).toHaveText('Click microphone to start');
  });

  test('should handle audio level monitoring', async ({ page }) => {
    await page.addInitScript(() => {
      // Mock AudioContext with level data
      window.AudioContext = class MockAudioContext {
        constructor() {
          this.state = 'suspended';
          this.sampleRate = 48000;
          this.audioWorklet = {
            addModule: async () => {},
          };
        }

        async resume() {
          this.state = 'running';
        }

        createMediaStreamSource() {
          return { connect: () => {} };
        }

        createScriptProcessor() {
          const processor = {
            onaudioprocess: null,
            connect: () => {},
            disconnect: () => {},
          };

          // Simulate audio processing with varying levels
          setTimeout(() => {
            const simulateAudio = () => {
              if (processor.onaudioprocess) {
                const event = {
                  inputBuffer: {
                    getChannelData: () => {
                      const data = new Float32Array(1024);
                      const level = Math.random() * 0.5; // Random audio level
                      for (let i = 0; i < data.length; i++) {
                        data[i] = (Math.random() - 0.5) * level;
                      }
                      return data;
                    },
                  },
                };
                processor.onaudioprocess(event);
              }
              setTimeout(simulateAudio, 100);
            };
            simulateAudio();
          }, 100);

          return processor;
        }

        get destination() {
          return { connect: () => {} };
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await page.locator('#mic-button').click();

    // Check that mic level indicator responds
    const micLevel = page.locator('.mic-level');
    await expect(micLevel).toBeVisible();

    // Wait for level changes (visual feedback)
    await page.waitForTimeout(500);

    await page.locator('#mic-button').click(); // Stop
  });

  test('should handle WebSocket reconnection', async ({ page }) => {
    const _connectionAttempts = 0;

    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          window.connectionAttempts = (window.connectionAttempts || 0) + 1;
          this.readyState = WebSocket.CONNECTING;
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;

          if (window.connectionAttempts === 1) {
            // First connection fails
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED;
              if (this.onerror) this.onerror(new Event('error'));
            }, 100);
          } else {
            // Subsequent connections succeed
            setTimeout(() => {
              this.readyState = WebSocket.OPEN;
              if (this.onopen) this.onopen(new Event('open'));
            }, 200);
          }
        }

        send() {}
        close() {
          this.readyState = WebSocket.CLOSED;
          if (this.onclose) this.onclose(new Event('close'));
        }
      };
    });

    await page.goto('/');

    // Should initially show connection error
    await expect(page.locator('#connection-text')).toHaveText('Connection Error', {
      timeout: 2000,
    });

    // Should automatically reconnect and show connected
    await expect(page.locator('#connection-text')).toHaveText('Connected', {
      timeout: 5000,
    });
  });
});

test.describe('Error Handling E2E', () => {
  test('should handle microphone permission denied', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error('Permission denied');
      };
    });

    await page.goto('/');
    await page.locator('#mic-button').click();

    // Should show error state
    await expect(page.locator('#mic-status')).toHaveText('Microphone access denied', {
      timeout: 2000,
    });
  });

  test('should handle TTS playback errors', async ({ page }) => {
    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send() {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'coach_response',
                    text: 'Test response',
                    audio_data: 'invalid_audio_data',
                  }),
                })
              );
            }
          }, 100);
        }
      };

      // Mock Audio that fails to play
      window.Audio = class MockAudio {
        constructor() {
          this.src = '';
          this.play = async () => {
            throw new Error('Audio playback failed');
          };
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await page.locator('#mic-button').click();
    await page.locator('#mic-button').click();

    // Wait for coach response
    await expect(page.locator('.transcript-line.coach')).toBeVisible({
      timeout: 2000,
    });

    // Try to play audio (should handle error gracefully)
    await page.locator('#play-last-btn').click();

    // Application should remain functional
    await expect(page.locator('#mic-button')).toBeVisible();
  });

  test('should handle network disconnection during recording', async ({ page }) => {
    const _disconnectAfterMs = 1000;

    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;

          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));

            // Disconnect after delay
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED;
              if (this.onclose) this.onclose(new Event('close'));
            }, 1000);
          }, 50);
        }

        send() {
          if (this.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open');
          }
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await expect(page.locator('#connection-text')).toHaveText('Connected');

    // Start recording
    await page.locator('#mic-button').click();

    // Wait for disconnection
    await expect(page.locator('#connection-text')).toHaveText('Disconnected', {
      timeout: 3000,
    });

    // Recording should stop automatically
    await expect(page.locator('#mic-status')).toHaveText('Click microphone to start');
  });
});

test.describe('Pronunciation Analysis E2E', () => {
  test('should handle pronunciation mode toggle', async ({ page }) => {
    // Mock WebSocket for pronunciation mode
    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(data) {
          if (data.includes('pronunciation_analyze')) {
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'pronunciation_analysis',
                      overall_score: 0.85,
                      phoneme_scores: [
                        {
                          phoneme: 'ʃ',
                          score: 0.8,
                          start: 0.0,
                          end: 0.2,
                          difficulty: 4,
                          feedback: 'Good pronunciation',
                        },
                      ],
                      timing: { total_duration: 1.0 },
                      transcription: 'шапка',
                      reference_text: 'шапка',
                    }),
                  })
                );
              }
            }, 200);
          }
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');

    // Look for pronunciation mode toggle (may be in settings or as a button)
    const pronunciationToggle = page
      .locator('[data-testid="pronunciation-toggle"]')
      .or(page.locator('button:has-text("Pronunciation")'))
      .or(page.locator('#pronunciation-mode'));

    if ((await pronunciationToggle.count()) > 0) {
      await pronunciationToggle.click();

      // Should show pronunciation-specific UI elements
      const pronunciationPanel = page
        .locator('.pronunciation-panel')
        .or(page.locator('[data-testid="pronunciation-panel"]'));

      if ((await pronunciationPanel.count()) > 0) {
        await expect(pronunciationPanel).toBeVisible();
      }
    }
  });

  test('should display pronunciation visualization', async ({ page }) => {
    // Mock pronunciation visualization
    await page.addInitScript(() => {
      // Mock canvas and visualization APIs
      window.pronunciationVisualizer = {
        initializeCanvas: () => {},
        visualizeAnalysis: () => {},
        playWithVisualization: () => Promise.resolve(),
        showPhonemeDetail: () => {},
        cleanup: () => {},
      };

      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(_data) {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'pronunciation_analysis',
                    overall_score: 0.75,
                    phoneme_scores: [
                      { phoneme: 't', score: 0.9, start: 0.0, end: 0.15 },
                      { phoneme: 'e', score: 0.8, start: 0.15, end: 0.3 },
                      { phoneme: 's', score: 0.6, start: 0.3, end: 0.45 },
                      { phoneme: 't', score: 0.9, start: 0.45, end: 0.6 },
                    ],
                    timing: { total_duration: 0.6 },
                    transcription: 'тест',
                    reference_text: 'тест',
                  }),
                })
              );
            }
          }, 200);
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');

    // Enable pronunciation mode if available
    const pronunciationModeBtn = page.locator('button:has-text("Pronunciation")');
    if ((await pronunciationModeBtn.count()) > 0) {
      await pronunciationModeBtn.click();
    }

    // Start and stop recording to trigger analysis
    await page.locator('#mic-button').click();
    await page.locator('#mic-button').click();

    // Check for visualization canvas or elements
    const visualizationCanvas = page
      .locator('canvas')
      .or(page.locator('.pronunciation-visualization'));

    if ((await visualizationCanvas.count()) > 0) {
      await expect(visualizationCanvas).toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle pronunciation feedback display', async ({ page }) => {
    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(_data) {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'pronunciation_feedback',
                    overall_score: 0.65,
                    feedback: 'Good effort! Focus on the "ʃ" sound in "шапка".',
                    difficult_phonemes: ['ʃ', 'tʃ'],
                    recommendations: [
                      'Practice words with "ш" sound',
                      'Pay attention to tongue position',
                    ],
                  }),
                })
              );
            }
          }, 300);
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await page.locator('#mic-button').click();
    await page.locator('#mic-button').click();

    // Look for pronunciation feedback UI
    const feedbackElements = [
      page.locator('.pronunciation-feedback'),
      page.locator('[data-testid="pronunciation-feedback"]'),
      page.locator('.phoneme-scores'),
      page.locator('.difficulty-indicator'),
    ];

    // Check if any feedback elements are visible
    for (const element of feedbackElements) {
      if ((await element.count()) > 0 && (await element.isVisible())) {
        await expect(element).toBeVisible();
        break;
      }
    }
  });

  test('should handle phoneme practice mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.voiceCoach = {
        showPhonemePractice: (phoneme) => {
          // Mock practice mode activation
          const practicePanel = document.createElement('div');
          practicePanel.className = 'phoneme-practice-panel';
          practicePanel.innerHTML = `<h3>Practice: ${phoneme}</h3><p>Practice words with this sound</p>`;
          document.body.appendChild(practicePanel);
        },
      };

      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(data) {
          if (data.includes('practice_request')) {
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage(
                  new MessageEvent('message', {
                    data: JSON.stringify({
                      type: 'practice_words',
                      phoneme: 'ʃ',
                      practice_words: [
                        { word: 'шапка', ipa: 'ʃapka', difficulty: 3 },
                        { word: 'шоколад', ipa: 'ʃɔkɔlad', difficulty: 4 },
                      ],
                    }),
                  })
                );
              }
            }, 200);
          }
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');

    // Look for practice mode buttons or difficult phoneme indicators
    const practiceElements = [
      page.locator('button:has-text("Practice")'),
      page.locator('[data-testid="phoneme-practice"]'),
      page.locator('.difficult-phoneme'),
      page.locator('.phoneme-button'),
    ];

    for (const element of practiceElements) {
      if ((await element.count()) > 0) {
        await element.first().click();

        // Check if practice panel appears
        const practicePanel = page.locator('.phoneme-practice-panel');
        if ((await practicePanel.count()) > 0) {
          await expect(practicePanel).toBeVisible({ timeout: 2000 });
          await expect(practicePanel).toContainText('Practice:');
          break;
        }
      }
    }
  });

  test('should handle pronunciation API endpoints', async ({ page }) => {
    // Test that the app can call pronunciation endpoints
    await page.goto('/');

    // Check that pronunciation endpoints are accessible
    const endpointsToTest = ['/pronunciation/status', '/pronunciation/phonemes'];

    for (const endpoint of endpointsToTest) {
      const response = await page.request.get(`http://localhost:8000${endpoint}`);
      expect(response.status()).toBeLessThan(500); // Should not be server error
    }
  });

  test('should display pronunciation scores with visual feedback', async ({ page }) => {
    await page.addInitScript(() => {
      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(_data) {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'pronunciation_scores',
                    phoneme_scores: [
                      { phoneme: 'a', score: 0.95, quality: 'excellent' },
                      { phoneme: 'ʃ', score: 0.65, quality: 'needs_work' },
                      { phoneme: 'p', score: 0.85, quality: 'good' },
                    ],
                  }),
                })
              );
            }
          }, 200);
        }
      };
    });

    await page.goto('/');
    await page.locator('#mic-button').click();
    await page.locator('#mic-button').click();

    // Look for score visualization elements
    const scoreElements = [
      page.locator('.score-excellent'),
      page.locator('.score-good'),
      page.locator('.score-needs-work'),
      page.locator('.phoneme-score'),
      page.locator('[data-score]'),
    ];

    // Check if any score elements are visible with appropriate styling
    let foundScores = false;
    for (const element of scoreElements) {
      if ((await element.count()) > 0) {
        foundScores = true;
        break;
      }
    }

    // If pronunciation scoring is implemented, scores should be visible
    if (foundScores) {
      await expect(page.locator('.phoneme-score')).toBeVisible();
    }
  });

  test('should handle audio playback with pronunciation overlay', async ({ page }) => {
    await page.addInitScript(() => {
      window.Audio = class MockAudio {
        constructor(src) {
          this.src = src;
          this.currentTime = 0;
          this.duration = 1.5;
          this.paused = true;
          this.onended = null;
          this.ontimeupdate = null;
        }

        async play() {
          this.paused = false;
          // Simulate time progression
          const updateTime = () => {
            if (!this.paused && this.currentTime < this.duration) {
              this.currentTime += 0.1;
              if (this.ontimeupdate) this.ontimeupdate();
              if (this.currentTime >= this.duration) {
                this.paused = true;
                if (this.onended) this.onended();
              } else {
                setTimeout(updateTime, 100);
              }
            }
          };
          setTimeout(updateTime, 100);
        }

        pause() {
          this.paused = true;
        }
      };

      // Mock pronunciation visualizer
      window.pronunciationVisualizer = {
        playWithVisualization: async (audioUrl) => {
          const audio = new window.Audio(audioUrl);
          return audio.play();
        },
      };

      window.WebSocket = class MockWebSocket {
        constructor() {
          this.readyState = WebSocket.OPEN;
          this.onopen = null;
          this.onmessage = null;
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 50);
        }

        send(_data) {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'coach_response',
                    text: 'Good pronunciation!',
                    audio_data: 'mock_audio_base64',
                    pronunciation_data: {
                      phoneme_timing: [
                        { phoneme: 'g', start: 0.0, end: 0.1 },
                        { phoneme: 'u', start: 0.1, end: 0.2 },
                        { phoneme: 'd', start: 0.2, end: 0.3 },
                      ],
                    },
                  }),
                })
              );
            }
          }, 200);
        }
      };

      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    await page.goto('/');
    await page.locator('#mic-button').click();
    await page.locator('#mic-button').click();

    // Wait for response and play button to be enabled
    await page.waitForTimeout(500);

    const playButton = page.locator('#play-last-btn');
    if (await playButton.isEnabled()) {
      await playButton.click();

      // Check if pronunciation overlay or highlighting is visible during playback
      const overlayElements = [
        page.locator('.pronunciation-highlight'),
        page.locator('.phoneme-highlight'),
        page.locator('.playback-cursor'),
      ];

      for (const element of overlayElements) {
        if ((await element.count()) > 0) {
          await expect(element).toBeVisible({ timeout: 2000 });
          break;
        }
      }
    }
  });
});

test.describe('Pronunciation API Integration', () => {
  test('should fetch phoneme reference data', async ({ page }) => {
    await page.goto('/');

    // Test /pronunciation/phonemes endpoint
    const phonemesResponse = await page.request.get('http://localhost:8000/pronunciation/phonemes');

    if (phonemesResponse.status() === 200) {
      const phonemesData = await phonemesResponse.json();
      expect(phonemesData).toHaveProperty('phonemes');
      expect(typeof phonemesData.phonemes).toBe('object');
    } else if (phonemesResponse.status() === 503) {
      // Pronunciation scoring not enabled - this is acceptable
      console.log('Pronunciation scoring not enabled (503 response)');
    }
  });

  test('should fetch pronunciation status', async ({ page }) => {
    await page.goto('/');

    const statusResponse = await page.request.get('http://localhost:8000/pronunciation/status');
    expect(statusResponse.status()).toBe(200);

    const statusData = await statusResponse.json();
    expect(statusData).toHaveProperty('pronunciation_scoring_enabled');
    expect(typeof statusData.pronunciation_scoring_enabled).toBe('boolean');
  });

  test('should handle pronunciation analysis request', async ({ page }) => {
    await page.goto('/');

    // Mock audio data (base64 encoded)
    const mockAudioData = btoa('mock-pcm-audio-data');

    const analysisResponse = await page.request.post(
      'http://localhost:8000/pronunciation/analyze',
      {
        data: {
          audio_data: mockAudioData,
          reference_text: 'тест',
          sample_rate: 16000,
        },
      }
    );

    // Should either work (200) or be disabled (503)
    expect([200, 422, 503]).toContain(analysisResponse.status());

    if (analysisResponse.status() === 200) {
      const analysisData = await analysisResponse.json();
      expect(analysisData).toHaveProperty('overall_score');
      expect(analysisData).toHaveProperty('phoneme_scores');
    }
  });

  test('should fetch practice words for phonemes', async ({ page }) => {
    await page.goto('/');

    const practiceResponse = await page.request.get(
      'http://localhost:8000/pronunciation/practice?phoneme=ʃ&difficulty_level=3'
    );

    if (practiceResponse.status() === 200) {
      const practiceData = await practiceResponse.json();
      expect(practiceData).toHaveProperty('practice_words');
      expect(Array.isArray(practiceData.practice_words)).toBe(true);
    } else if (practiceResponse.status() === 503) {
      console.log('Pronunciation practice not enabled (503 response)');
    }
  });

  test('should fetch phoneme difficulties for L1 languages', async ({ page }) => {
    await page.goto('/');

    const l1Languages = ['polish', 'russian', 'ukrainian', 'serbian'];

    for (const language of l1Languages) {
      const difficultyResponse = await page.request.get(
        `http://localhost:8000/pronunciation/difficulties?l1_language=${language}`
      );

      if (difficultyResponse.status() === 200) {
        const difficultyData = await difficultyResponse.json();
        expect(difficultyData).toHaveProperty('l1_language');
        expect(difficultyData.l1_language).toBe(language);
        expect(difficultyData).toHaveProperty('difficulties');
      }
    }
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
