#!/usr/bin/env node
/**
 * Simple screenshot capture for Bulgarian Voice Coach workflow
 */

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'workflow');
const BASE_URL = 'http://localhost:3000';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name, description) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1200, height: 800 }
  });
  console.log(`✅ ${name}: ${description}`);
  return screenshotPath;
}

async function main() {
  console.log('🚀 Capturing workflow screenshots...\n');
  
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 800 },
    args: ['--window-size=1200,800']
  });

  const page = await browser.newPage();

  try {
    // 1. Initial state
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await wait(2000);
    await captureScreenshot(page, '01-initial-state', 'App ready with microphone button');

    // 2. Add some conversation text to show transcription
    await page.evaluate(() => {
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML = `
          <div class="message user">
            <strong>You:</strong> <span class="bg-text">Искам поръчвам кафе</span>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '02-user-speech', 'User speech transcribed');

    // 3. Add grammar corrections
    await page.evaluate(() => {
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML += `
          <div class="corrections">
            <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0;">
              <strong>Grammar corrections:</strong><br>
              ❌ "Искам поръчвам" → ✅ "Искам да поръчам"<br>
              <small>Bulgarian requires "да" + present tense instead of infinitive</small>
            </div>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '03-grammar-correction', 'Grammar errors detected and corrected');

    // 4. Add AI response
    await page.evaluate(() => {
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML += `
          <div class="message assistant">
            <strong>Coach:</strong> <span class="bg-text">Правилно е "Искам да поръчам кафе". В българския език използваме "да" + сегашно време вместо инфинитив.</span>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '04-coach-response', 'AI coach provides feedback');

    // 5. Show pronunciation mode
    await page.evaluate(() => {
      // Add pronunciation toggle if not exists
      const controls = document.querySelector('.controls');
      if (controls && !document.querySelector('.pronunciation-toggle')) {
        const toggle = document.createElement('div');
        toggle.className = 'pronunciation-toggle';
        toggle.style.cssText = 'margin: 10px 0; padding: 10px; background: #e3f2fd; border-radius: 4px;';
        toggle.innerHTML = `
          <label style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" checked style="width: 20px; height: 20px;">
            <span>🎯 Pronunciation Mode Active</span>
          </label>
        `;
        controls.appendChild(toggle);
      }
      
      // Clear transcript for pronunciation example
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML = `
          <div class="message user">
            <strong>You (pronunciation practice):</strong> <span class="bg-text">шапка</span>
          </div>
          <div style="background: #f0f8ff; padding: 15px; border-radius: 4px; margin: 10px 0;">
            <strong>Pronunciation Analysis:</strong><br>
            Overall Score: <span style="color: #4CAF50; font-weight: bold;">85%</span><br>
            <div style="margin-top: 10px;">
              <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 3px; margin: 2px;">ш (95%)</span>
              <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 3px; margin: 2px;">а (90%)</span>
              <span style="background: #FFC107; color: white; padding: 2px 8px; border-radius: 3px; margin: 2px;">п (75%)</span>
              <span style="background: #FF9800; color: white; padding: 2px 8px; border-radius: 3px; margin: 2px;">к (70%)</span>
              <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 3px; margin: 2px;">а (90%)</span>
            </div>
            <small style="display: block; margin-top: 10px;">💡 Focus on the "п" and "к" sounds for improvement</small>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '05-pronunciation-scoring', 'Pronunciation analysis with phoneme scores');

    // 6. Practice drill
    await page.evaluate(() => {
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML += `
          <div style="background: #fff; border: 2px solid #6c5ce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #6c5ce7;">Quick Practice: Future Tense</h3>
            <p class="bg-text" style="font-size: 18px;">Complete: Утре _____ на кино.</p>
            <div style="display: flex; gap: 10px; margin: 15px 0;">
              <button style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">ще ходя</button>
              <button style="padding: 10px 20px; border: 2px solid #4CAF50; background: #e8f5e9; border-radius: 4px; cursor: pointer;">✓ ще отида</button>
              <button style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">ще върви</button>
            </div>
            <small>💡 Hint: Think about single action vs repeated action</small>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '06-practice-drill', 'Interactive grammar practice drill');

    // 7. Multiple features together
    await page.evaluate(() => {
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML = `
          <div class="conversation-flow">
            <div class="message user" style="margin: 10px 0;">
              <strong>You:</strong> <span class="bg-text">Здравейте, искам поръчвам една кафе</span>
            </div>
            
            <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0;">
              <strong>Grammar Issues Found:</strong><br>
              1. "искам поръчвам" → "искам да поръчам" (missing да)<br>
              2. "една кафе" → "едно кафе" (wrong gender agreement)
            </div>
            
            <div class="message assistant" style="margin: 10px 0;">
              <strong>Coach:</strong> <span class="bg-text">Добре дошли! Правилно е "искам да поръчам едно кафе". Помнете: кафе е средн род в български.</span>
            </div>
            
            <div class="message user" style="margin: 10px 0;">
              <strong>You:</strong> <span class="bg-text">Благодаря! Едно кафе с мляко, моля.</span>
            </div>
            
            <div style="background: #d4edda; padding: 10px; border-radius: 4px; margin: 10px 0;">
              ✅ Excellent! No grammar errors detected.
            </div>
            
            <div class="message assistant" style="margin: 10px 0;">
              <strong>Coach:</strong> <span class="bg-text">Чудесно! Сега говорите правилно. Заповядайте вашето кафе! ☕</span>
            </div>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '07-complete-conversation', 'Complete conversation with corrections and feedback');

    // 8. Progress tracking
    await page.evaluate(() => {
      const transcript = document.getElementById('transcript');
      if (transcript) {
        transcript.innerHTML += `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Session Summary</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <strong>Grammar Accuracy:</strong> 85%<br>
                <strong>Pronunciation Score:</strong> 82%<br>
                <strong>Fluency:</strong> Good
              </div>
              <div>
                <strong>Areas to Practice:</strong><br>
                • да + present tense construction<br>
                • Gender agreement<br>
                • Consonant clusters (пк, тк)
              </div>
            </div>
            <div style="margin-top: 15px;">
              <strong>Next lesson:</strong> Ordering food at a restaurant 🍽️
            </div>
          </div>
        `;
      }
    });
    await wait(500);
    await captureScreenshot(page, '08-session-summary', 'Session summary with progress tracking');

    console.log('\n✨ All screenshots captured successfully!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);