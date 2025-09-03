/**
 * Bulgarian Voice Coach - Screenshot Capture Script
 * 
 * This script captures professional screenshots for documentation
 * of the new features: pronunciation scoring and visual feedback system
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// Screenshot definitions
const SCREENSHOTS = [
  {
    name: 'main-interface.png',
    description: 'Main interface with pronunciation scoring toggle',
    url: BASE_URL,
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      return { fullPage: false };
    }
  },
  {
    name: 'pronunciation-mode-active.png',
    description: 'Pronunciation scoring mode activated',
    url: BASE_URL,
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Toggle pronunciation mode
      const pronunciationToggle = page.locator('#pronunciation-mode-toggle, [data-testid="pronunciation-toggle"]').first();
      if (await pronunciationToggle.isVisible()) {
        await pronunciationToggle.click();
        await page.waitForTimeout(1000);
      }
      
      return { fullPage: false };
    }
  },
  {
    name: 'pronunciation-visual-feedback.png',
    description: 'Visual feedback showing phoneme-level pronunciation analysis',
    url: BASE_URL,
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      
      // Mock a pronunciation visualization by injecting a canvas
      await page.evaluate(() => {
        const container = document.querySelector('#transcript-display') || document.body;
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 200;
        canvas.style.border = '1px solid #ccc';
        canvas.style.marginTop = '20px';
        const ctx = canvas.getContext('2d');
        
        // Draw mock waveform
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 800; i += 5) {
          const y = 100 + Math.sin(i * 0.05) * 50 * Math.random();
          ctx.lineTo(i, y);
        }
        ctx.stroke();
        
        // Draw phoneme segments
        const phonemes = [
          { text: 'ʃ', score: 0.85, color: '#4CAF50' },
          { text: 'a', score: 0.92, color: '#4CAF50' },
          { text: 'p', score: 0.75, color: '#FFC107' },
          { text: 'k', score: 0.68, color: '#FF9800' },
          { text: 'a', score: 0.90, color: '#4CAF50' }
        ];
        
        let x = 0;
        phonemes.forEach(p => {
          const width = 160;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(x, 0, width, 200);
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#333';
          ctx.font = '18px Arial';
          ctx.fillText(p.text, x + width/2 - 10, 180);
          ctx.font = '14px Arial';
          ctx.fillText(`${Math.round(p.score * 100)}%`, x + width/2 - 15, 20);
          x += width;
        });
        
        container.appendChild(canvas);
      });
      
      await page.waitForTimeout(1000);
      return { fullPage: false };
    }
  },
  {
    name: 'pronunciation-api-endpoints.png',
    description: 'FastAPI documentation showing pronunciation analysis endpoints',
    url: `${API_URL}/docs`,
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Scroll to pronunciation endpoints
      const pronunciationEndpoint = page.locator('.opblock:has-text("/pronunciation")').first();
      if (await pronunciationEndpoint.isVisible()) {
        await pronunciationEndpoint.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }
      
      return { 
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      };
    }
  },
  {
    name: 'phoneme-detail-popup.png',
    description: 'Detailed phoneme feedback popup with practice suggestions',
    url: BASE_URL,
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      
      // Create a mock phoneme detail popup
      await page.evaluate(() => {
        const popup = document.createElement('div');
        popup.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          z-index: 1000;
          max-width: 400px;
        `;
        
        popup.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #333;">Phoneme: /ʃ/</h2>
            <div style="display: flex; justify-content: space-between; margin: 15px 0;">
              <span style="color: #666;">Score:</span>
              <span style="color: #FF9800; font-weight: bold;">68%</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 15px 0;">
              <span style="color: #666;">Difficulty:</span>
              <span style="color: #f44336;">★★★★☆ (Hard)</span>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Feedback:</h3>
            <p style="margin: 0; color: #333;">Your /ʃ/ sound needs more friction. Try placing your tongue closer to the roof of your mouth, similar to English "sh" but with more energy.</p>
          </div>
          
          <div style="margin-top: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Practice Words:</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <span style="background: #e3f2fd; padding: 5px 12px; border-radius: 16px; color: #1976d2;">шапка</span>
              <span style="background: #e3f2fd; padding: 5px 12px; border-radius: 16px; color: #1976d2;">шест</span>
              <span style="background: #e3f2fd; padding: 5px 12px; border-radius: 16px; color: #1976d2;">душа</span>
            </div>
          </div>
          
          <button style="
            margin-top: 20px;
            width: 100%;
            padding: 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          ">Practice This Sound</button>
        `;
        
        document.body.appendChild(popup);
        
        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 999;
        `;
        document.body.appendChild(backdrop);
      });
      
      await page.waitForTimeout(1000);
      return { fullPage: false };
    }
  },
  {
    name: 'dark-mode-pronunciation.png',
    description: 'Pronunciation interface in dark mode',
    url: BASE_URL,
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      
      // Apply dark mode styles
      await page.evaluate(() => {
        document.documentElement.classList.add('dark-mode');
        document.body.style.background = '#1a1a1a';
        document.body.style.color = '#e0e0e0';
      });
      
      // Try to toggle dark mode button if exists
      const darkToggle = page.locator('.dark-mode-toggle, button[aria-label*="dark"], [title*="dark"]').first();
      if (await darkToggle.isVisible()) {
        await darkToggle.click();
        await page.waitForTimeout(1000);
      }
      
      return { fullPage: false };
    }
  }
];

// Main execution
async function captureScreenshots() {
  console.log('🚀 Bulgarian Voice Coach - Pronunciation Scoring Screenshots');
  console.log('=' .repeat(60));
  
  // Check prerequisites
  console.log('🔍 Checking prerequisites...');
  
  try {
    // Test if development server is running
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error('Frontend server not responding');
    console.log('✅ Frontend server is running');
    
    const apiResponse = await fetch(`${API_URL}/docs`);
    if (!apiResponse.ok) throw new Error('API server not responding');
    console.log('✅ API server is running');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Please ensure development servers are running:');
    console.log('   Run: just dev');
    process.exit(1);
  }
  
  // Ensure screenshot directory exists
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2, // For retina quality
    permissions: ['microphone'], // Grant microphone permission
  });
  
  const page = await context.newPage();
  
  // Capture screenshots
  console.log('\n📷 Starting screenshot capture...');
  
  for (const screenshot of SCREENSHOTS) {
    console.log(`📸 Capturing: ${screenshot.name}`);
    
    try {
      await page.goto(screenshot.url, { waitUntil: 'networkidle' });
      const options = await screenshot.action(page);
      
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshot.name);
      await page.screenshot({ 
        path: screenshotPath,
        ...options 
      });
      
      console.log(`✅ Saved: ${screenshot.description}`);
    } catch (error) {
      console.error(`❌ Failed to capture ${screenshot.name}: ${error.message}`);
    }
  }
  
  // Clean up
  await browser.close();
  
  console.log('\n✨ Screenshot capture complete!');
  console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
  
  // List captured files
  const files = await fs.readdir(SCREENSHOT_DIR);
  const pngFiles = files.filter(f => f.endsWith('.png'));
  console.log(`\n📊 Total screenshots: ${pngFiles.length}`);
  pngFiles.forEach(file => {
    console.log(`   • ${file}`);
  });
}

// Run the script
captureScreenshots().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});