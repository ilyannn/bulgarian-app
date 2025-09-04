#!/usr/bin/env node
/**
 * Capture workflow screenshots for Bulgarian Voice Coach
 * This script simulates user interactions to capture the end-to-end workflow
 */

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'workflow');
const BASE_URL = 'http://localhost:3000';

async function captureScreenshot(page, name, description) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1200, height: 800 }
  });
  console.log(`✅ Captured: ${name}.png - ${description}`);
  return screenshotPath;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateTyping(page, selector, text, delay = 50) {
  await page.focus(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await wait(delay);
  }
}

async function main() {
  console.log('🚀 Starting workflow screenshot capture...\n');
  
  // Create screenshot directory
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true, // Automated capture mode
    defaultViewport: { width: 1200, height: 800 },
    args: ['--window-size=1200,800']
  });

  const page = await browser.newPage();

  try {
    // 1. Initial state
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await wait(1000);
    await captureScreenshot(page, '01-initial-state', 'Application ready with microphone button');

    // 2. Simulate microphone click (can't actually record, but show UI state)
    await page.evaluate(() => {
      // Update UI to show recording state
      const micButton = document.getElementById('micButton');
      if (micButton) {
        micButton.classList.add('recording');
        micButton.querySelector('.mic-icon').textContent = '🔴';
      }
      const statusEl = document.querySelector('.latency');
      if (statusEl) statusEl.textContent = 'Recording...';
    });
    await wait(500);
    await captureScreenshot(page, '02-recording-active', 'Microphone recording active');

    // 3. Add transcribed text
    await page.evaluate(() => {
      const conversation = document.getElementById('conversation');
      if (conversation) {
        const userMessage = document.createElement('div');
        userMessage.className = 'message user-message';
        userMessage.innerHTML = `
          <div class="message-content">
            <div class="speaker">👤 You</div>
            <div class="text bg-text">Утре ще ходя на пазар да купувам зеленчуци</div>
          </div>
        `;
        conversation.appendChild(userMessage);
        conversation.scrollTop = conversation.scrollHeight;
      }
      // Reset mic button
      const micButton = document.getElementById('micButton');
      if (micButton) {
        micButton.classList.remove('recording');
        micButton.querySelector('.mic-icon').textContent = '🎤';
      }
      document.querySelector('.latency').textContent = 'Processing...';
    });
    await wait(500);
    await captureScreenshot(page, '03-speech-transcribed', 'User speech transcribed to Bulgarian text');

    // 4. Add grammar corrections
    await page.evaluate(() => {
      const conversation = document.getElementById('conversation');
      if (conversation) {
        const grammarChips = document.createElement('div');
        grammarChips.className = 'grammar-chips-container';
        grammarChips.innerHTML = `
          <div class="grammar-chips">
            <div class="grammar-chip error-moderate" data-error-tag="bg.future_tense">
              <span class="chip-icon">⚠️</span>
              <span class="chip-text">ще ходя → ще отида</span>
              <span class="chip-arrow">▼</span>
            </div>
            <div class="grammar-chip error-minor" data-error-tag="bg.verb_aspect">
              <span class="chip-icon">💡</span>
              <span class="chip-text">купувам → купя</span>
              <span class="chip-arrow">▼</span>
            </div>
          </div>
        `;
        conversation.appendChild(grammarChips);
      }
      document.querySelector('.latency').textContent = 'Latency: 1.2s';
    });
    await wait(500);
    await captureScreenshot(page, '04-grammar-errors-detected', 'Grammar errors detected and displayed as chips');

    // 5. Expand grammar correction
    await page.evaluate(() => {
      const firstChip = document.querySelector('.grammar-chip');
      if (firstChip) {
        firstChip.classList.add('expanded');
        const details = document.createElement('div');
        details.className = 'chip-details';
        details.innerHTML = `
          <div class="error-explanation">
            <strong>Future tense with motion verbs:</strong><br>
            Use "ще отида" for single future action of going.<br>
            "Ще ходя" implies repeated/habitual future action.
          </div>
          <div class="chip-actions">
            <button class="btn-practice">📝 Practice</button>
            <button class="btn-more">ℹ️ Learn More</button>
          </div>
        `;
        firstChip.appendChild(details);
      }
    });
    await wait(500);
    await captureScreenshot(page, '05-grammar-correction-expanded', 'Grammar chip expanded showing detailed explanation');

    // 6. Show practice drill
    await page.evaluate(() => {
      const drillContainer = document.createElement('div');
      drillContainer.className = 'inline-drill-container active';
      drillContainer.innerHTML = `
        <div class="drill-card">
          <div class="drill-header">
            <h3>Quick Practice: Future Tense</h3>
            <div class="drill-timer">⏱️ 15s</div>
          </div>
          <div class="drill-content">
            <div class="drill-prompt bg-text">
              Complete: Утре _____ на кино.
            </div>
            <div class="drill-options">
              <button class="option-btn">ще ходя</button>
              <button class="option-btn correct">ще отида</button>
              <button class="option-btn">ще върви</button>
            </div>
            <div class="drill-hint" style="display: none;">
              💡 Think: single action vs repeated action
            </div>
          </div>
        </div>
      `;
      document.querySelector('.conversation-section').appendChild(drillContainer);
    });
    await wait(500);
    await captureScreenshot(page, '06-practice-drill-active', 'Interactive practice drill for the grammar concept');

    // 7. Show drill completion
    await page.evaluate(() => {
      const drillCard = document.querySelector('.drill-card');
      if (drillCard) {
        drillCard.innerHTML = `
          <div class="drill-header">
            <h3>Practice Complete! ✅</h3>
          </div>
          <div class="drill-results">
            <div class="result-score">
              <div class="score-circle">
                <span class="score-value">100%</span>
              </div>
            </div>
            <div class="result-details">
              <p>✅ Correct answer: <span class="bg-text">ще отида</span></p>
              <p>📊 Response time: 3.2s</p>
              <p>🎯 Mastery level: 75%</p>
            </div>
            <div class="result-actions">
              <button class="btn-continue">Continue Learning</button>
              <button class="btn-more-practice">More Practice</button>
            </div>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '07-drill-completed', 'Practice drill completed with results and progress');

    // 8. Show assistant response
    await page.evaluate(() => {
      // Remove drill
      const drill = document.querySelector('.inline-drill-container');
      if (drill) drill.remove();
      
      const conversation = document.getElementById('conversation');
      if (conversation) {
        const assistantMessage = document.createElement('div');
        assistantMessage.className = 'message assistant-message';
        assistantMessage.innerHTML = `
          <div class="message-content">
            <div class="speaker">🤖 Coach</div>
            <div class="text bg-text">
              Много добре! Правилно е "Утре ще отида на пазар да купя зеленчуци."<br><br>
              Запомнете: използваме "отида" за еднократно действие и перфектив "купя" вместо имперфектив "купувам" когато говорим за конкретна покупка.
            </div>
          </div>
        `;
        conversation.appendChild(assistantMessage);
        conversation.scrollTop = conversation.scrollHeight;
      }
    });
    await wait(500);
    await captureScreenshot(page, '08-coach-feedback', 'AI coach provides personalized feedback');

    // 9. Pronunciation mode
    await page.evaluate(() => {
      // Add pronunciation toggle
      const controls = document.querySelector('.controls-section');
      if (controls && !document.getElementById('pronunciation-mode-toggle')) {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'pronunciation-toggle';
        toggleDiv.innerHTML = `
          <label class="switch">
            <input type="checkbox" id="pronunciation-mode-toggle" checked>
            <span class="slider"></span>
          </label>
          <span>Pronunciation Mode</span>
        `;
        controls.insertBefore(toggleDiv, controls.firstChild);
      }
      
      // Add pronunciation visualization
      const conversation = document.getElementById('conversation');
      if (conversation) {
        const pronunciationViz = document.createElement('div');
        pronunciationViz.className = 'pronunciation-visualization';
        pronunciationViz.innerHTML = `
          <div class="pronunciation-header">
            <h3>Pronunciation Analysis: "шапка"</h3>
            <div class="overall-score">Score: 85%</div>
          </div>
          <canvas id="pronunciation-canvas" width="600" height="150" style="border: 1px solid #ccc; border-radius: 4px;"></canvas>
          <div class="phoneme-scores">
            <span class="phoneme good">ш (95%)</span>
            <span class="phoneme good">а (90%)</span>
            <span class="phoneme moderate">п (75%)</span>
            <span class="phoneme moderate">к (70%)</span>
            <span class="phoneme good">а (90%)</span>
          </div>
        `;
        conversation.appendChild(pronunciationViz);
        
        // Draw simple waveform
        const canvas = document.getElementById('pronunciation-canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 75, 120, 3);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(120, 75, 120, 3);
        ctx.fillStyle = '#FFC107';
        ctx.fillRect(240, 75, 120, 3);
        ctx.fillStyle = '#FFC107';
        ctx.fillRect(360, 75, 120, 3);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(480, 75, 120, 3);
      }
    });
    await wait(500);
    await captureScreenshot(page, '09-pronunciation-analysis', 'Pronunciation scoring with phoneme-level feedback');

    console.log('\n✨ All screenshots captured successfully!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);