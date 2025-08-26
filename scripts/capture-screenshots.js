#!/usr/bin/env node
/**
 * Official Screenshot Capture Script for Bulgarian Voice Coach
 * 
 * This script captures professional screenshots of the application's UI components
 * for documentation purposes. It uses Playwright to automate browser interactions
 * and capture high-quality images of:
 * 
 * - Main application interface
 * - Grammar Chips UI (collapsed and expanded states)
 * - Inline Drill Interface (default and hint states)
 * - Complete voice coaching workflow demonstration
 * 
 * Prerequisites:
 * - Development servers must be running (just dev)
 * - Playwright must be installed (npm install @playwright/test)
 * 
 * Usage:
 *   node scripts/capture-screenshots.js
 *   # or via Justfile:
 *   just screenshots
 * 
 * Output:
 *   Screenshots are saved to the screenshots/ directory in the project root
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
  viewport: { width: 1200, height: 800 },
  baseUrl: 'http://localhost:3000',
  screenshotsDir: path.join(__dirname, '..', 'screenshots'),
  headless: true,
  timeout: 30000, // 30 second timeout
};

// Screenshot definitions with metadata
const SCREENSHOTS = [
  {
    name: 'main-interface.png',
    description: 'Main voice coaching interface with microphone controls',
    url: '/',
    action: async (page) => {
      // Wait for app to be fully loaded
      await page.waitForLoadState('networkidle');
      return { fullPage: false };
    }
  },
  {
    name: 'grammar-chips-collapsed.png', 
    description: 'Grammar correction chips in default collapsed state',
    url: '/demo-components.html',
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Wait for components to initialize
      
      // Ensure grammar chips are visible
      await page.locator('#grammar-chips-demo').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      return { 
        fullPage: false,
        clip: { x: 0, y: 200, width: 800, height: 300 }
      };
    }
  },
  {
    name: 'grammar-chips-expanded.png',
    description: 'Grammar correction chips with detailed explanations expanded', 
    url: '/demo-components.html',
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Scroll to grammar chips and expand first one
      await page.locator('#grammar-chips-demo').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      const firstChip = page.locator('.grammar-chip').first();
      if (await firstChip.isVisible()) {
        await firstChip.click();
        await page.waitForTimeout(1000); // Wait for expansion animation
      }
      
      return { 
        fullPage: false,
        clip: { x: 0, y: 200, width: 800, height: 400 }
      };
    }
  },
  {
    name: 'inline-drill-interface.png',
    description: '20-second practice drill interface with timer and input',
    url: '/demo-components.html', 
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Scroll to drill section
      await page.locator('#inline-drill-demo').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      return { 
        fullPage: false,
        clip: { x: 0, y: 500, width: 800, height: 250 }
      };
    }
  },
  {
    name: 'inline-drill-hint.png',
    description: 'Drill interface with hint system activated',
    url: '/demo-components.html',
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Scroll to drill section and show hint
      await page.locator('#inline-drill-demo').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      const hintButton = page.locator('.hint-btn, button:has-text("Hint")').first();
      if (await hintButton.isVisible()) {
        await hintButton.click();
        await page.waitForTimeout(500);
      }
      
      return { 
        fullPage: false,
        clip: { x: 0, y: 500, width: 800, height: 250 }
      };
    }
  },
  {
    name: 'voice-coaching-workflow.png',
    description: 'Complete voice coaching workflow demonstration',
    url: '/',
    action: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Try to activate microphone button for demonstration
      const micButton = page.locator('button:has-text("Start"), .mic-button, #start-btn').first();
      if (await micButton.isVisible()) {
        try {
          await micButton.click();
          await page.waitForTimeout(1000);
        } catch (e) {
          // Ignore if mic activation fails - just capture interface
        }
      }
      
      return { fullPage: false };
    }
  }
];

/**
 * Check if development servers are running
 */
async function checkServers() {
  const page = await chromium.launch({ headless: true }).then(browser => 
    browser.newContext().then(context => context.newPage())
  );
  
  try {
    await page.goto(CONFIG.baseUrl, { timeout: 5000, waitUntil: 'domcontentloaded' });
    await page.close();
    return true;
  } catch (error) {
    await page.close();
    return false;
  }
}

/**
 * Ensure screenshots directory exists
 */
async function ensureScreenshotsDir() {
  try {
    await fs.access(CONFIG.screenshotsDir);
  } catch {
    await fs.mkdir(CONFIG.screenshotsDir, { recursive: true });
    console.log(`📁 Created screenshots directory: ${CONFIG.screenshotsDir}`);
  }
}

/**
 * Capture a single screenshot based on configuration
 */
async function captureScreenshot(page, screenshot) {
  try {
    console.log(`📸 Capturing: ${screenshot.name}`);
    
    // Navigate to the URL
    const fullUrl = `${CONFIG.baseUrl}${screenshot.url}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
    
    // Execute screenshot-specific actions
    const options = await screenshot.action(page);
    
    // Capture the screenshot
    const screenshotPath = path.join(CONFIG.screenshotsDir, screenshot.name);
    await page.screenshot({ path: screenshotPath, ...options });
    
    console.log(`✅ Saved: ${screenshot.description}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to capture ${screenshot.name}:`, error.message);
    return false;
  }
}

/**
 * Main screenshot capture function
 */
async function captureScreenshots() {
  console.log('🚀 Bulgarian Voice Coach - Screenshot Capture Script');
  console.log('=' .repeat(60));
  
  // Check prerequisites
  console.log('🔍 Checking prerequisites...');
  
  const serversRunning = await checkServers();
  if (!serversRunning) {
    console.error('❌ Development servers not running!');
    console.error('   Please run: just dev');
    console.error('   Then try again: just screenshots');
    process.exit(1);
  }
  console.log('✅ Development servers are running');
  
  // Ensure output directory exists
  await ensureScreenshotsDir();
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ 
    headless: CONFIG.headless,
    timeout: CONFIG.timeout
  });
  
  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    // Mock media permissions to prevent browser prompts
    permissions: ['microphone'],
  });
  
  const page = await context.newPage();
  
  // Set longer timeout for page actions
  page.setDefaultTimeout(CONFIG.timeout);
  
  try {
    console.log('\n📷 Starting screenshot capture...');
    
    let successCount = 0;
    let totalCount = SCREENSHOTS.length;
    
    // Capture each screenshot
    for (const screenshot of SCREENSHOTS) {
      const success = await captureScreenshot(page, screenshot);
      if (success) successCount++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`🎉 Screenshot capture completed!`);
    console.log(`✅ Successfully captured: ${successCount}/${totalCount} screenshots`);
    
    if (successCount < totalCount) {
      console.log(`⚠️  ${totalCount - successCount} screenshots failed`);
    }
    
    // List captured files
    console.log('\n📁 Screenshots saved to:');
    try {
      const files = await fs.readdir(CONFIG.screenshotsDir);
      const pngFiles = files.filter(f => f.endsWith('.png')).sort();
      
      if (pngFiles.length === 0) {
        console.log('   (no PNG files found)');
      } else {
        for (const file of pngFiles) {
          const filePath = path.join(CONFIG.screenshotsDir, file);
          const stats = await fs.stat(filePath);
          const sizeKB = Math.round(stats.size / 1024);
          console.log(`   ${file} (${sizeKB} KB)`);
        }
      }
    } catch (error) {
      console.error('   Error listing files:', error.message);
    }
    
    console.log('\n💡 Screenshots can be used in documentation:');
    console.log('   README.md already includes these images');
    console.log('   Update docs with: git add screenshots/ && git commit');
    
  } catch (error) {
    console.error('\n❌ Fatal error during screenshot capture:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script if called directly
if (require.main === module) {
  captureScreenshots().catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { captureScreenshots, CONFIG, SCREENSHOTS };