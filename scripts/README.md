# Scripts Directory

This directory contains utility scripts for the Bulgarian Voice Coach project.

## capture-screenshots.js

**Purpose**: Official screenshot capture script for generating professional documentation images.

**What it does**:
- Captures high-quality screenshots of UI components using Playwright automation
- Generates 6 different screenshots showcasing the application's key features
- Saves images to the `screenshots/` directory for use in documentation

**Prerequisites**:
1. Development servers must be running: `just dev`
2. Playwright must be installed: `cd client && bun install` 

**Usage**:

```bash
# Via Justfile (recommended)
just screenshots

# Or directly
node scripts/capture-screenshots.js
```

**Screenshots captured**:

1. **main-interface.png** - Complete voice coaching interface with microphone controls
2. **grammar-chips-collapsed.png** - Grammar correction chips in default state  
3. **grammar-chips-expanded.png** - Grammar chips with detailed explanations expanded
4. **inline-drill-interface.png** - 20-second practice drill interface
5. **inline-drill-hint.png** - Drill interface with hint system activated
6. **voice-coaching-workflow.png** - Complete workflow demonstration

**Features**:
- ✅ Comprehensive error handling and prerequisite checking
- ✅ Detailed logging with progress indicators  
- ✅ Configurable viewport and timeout settings
- ✅ Automatic screenshots directory creation
- ✅ File size reporting and success statistics
- ✅ Browser automation with proper cleanup
- ✅ Professional image quality with optimized dimensions

**Technical details**:
- Uses Playwright's Chromium engine for consistent rendering
- Screenshots saved as PNG format with optimized quality
- Viewport: 1200x800 for high-quality captures
- Clips specific regions for focused component screenshots
- Handles animations and loading states properly

**Output directory**: `/screenshots/` (project root)

**Integration**: The script is integrated into the build system via the `just screenshots` command and is documented in README.md.