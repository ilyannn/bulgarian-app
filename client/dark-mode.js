/**
 * Dark Mode System for Bulgarian Voice Coach
 * Provides seamless dark/light theme switching with user preference persistence
 */

export class DarkModeSystem {
  constructor() {
    this.isDarkMode = this.getStoredPreference();
    this.toggleButton = null;
    this.themeIcon = null;

    this.init();
  }

  /**
   * Initialize dark mode system
   */
  init() {
    this.createToggleButton();
    this.injectStyles();
    this.applyTheme(this.isDarkMode, false); // false = no animation on initial load
    this.setupEventListeners();

    // Listen for system theme changes
    this.watchSystemTheme();
  }

  /**
   * Create the dark mode toggle button
   */
  createToggleButton() {
    // Find the header or create a container for the toggle
    const header = document.querySelector('.header');
    if (!header) return;

    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'theme-toggle-container';

    // Create toggle button
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'theme-toggle-btn';
    this.toggleButton.title = 'Toggle dark/light mode (Ctrl/Cmd+D)';
    this.toggleButton.setAttribute('aria-label', 'Toggle theme');

    // Create icon container
    this.themeIcon = document.createElement('span');
    this.themeIcon.className = 'theme-icon';
    this.updateToggleIcon();

    this.toggleButton.appendChild(this.themeIcon);
    toggleContainer.appendChild(this.toggleButton);

    // Insert after the header title
    const headerTitle = header.querySelector('h1');
    if (headerTitle) {
      headerTitle.insertAdjacentElement('afterend', toggleContainer);
    } else {
      header.appendChild(toggleContainer);
    }
  }

  /**
   * Inject dark mode styles
   */
  injectStyles() {
    const styles = `
      .theme-toggle-container {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
      }

      .theme-toggle-btn {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 48px;
        height: 48px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .theme-toggle-btn::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transform: rotate(45deg);
        transition: all 0.6s ease;
        opacity: 0;
      }

      .theme-toggle-btn:hover::before {
        opacity: 1;
        left: 100%;
      }

      .theme-toggle-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      }

      .theme-toggle-btn:active {
        transform: scale(0.95);
      }

      .theme-icon {
        font-size: 1.4rem;
        transition: all 0.3s ease;
        position: relative;
        z-index: 1;
      }

      /* Dark mode theme toggle adjustments */
      [data-theme="dark"] .theme-toggle-btn {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }

      [data-theme="dark"] .theme-toggle-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
      }

      /* Rotating animation for theme switch */
      .theme-icon.switching {
        animation: rotate 0.5s ease;
      }

      @keyframes rotate {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(180deg) scale(1.2); }
        100% { transform: rotate(360deg) scale(1); }
      }

      /* Dark theme styles */
      [data-theme="dark"] {
        color-scheme: dark;
      }

      [data-theme="dark"] body {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #e0e0e0;
      }

      [data-theme="dark"] .app-container {
        background: rgba(30, 30, 30, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e0e0e0;
      }

      [data-theme="dark"] .header h1 {
        background: linear-gradient(135deg, #64b5f6, #42a5f5);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      [data-theme="dark"] .header p {
        color: #b0b0b0;
      }

      /* Dark mode mic panel */
      [data-theme="dark"] .mic-panel {
        background: rgba(100, 181, 246, 0.1);
        border: 2px solid transparent;
      }

      [data-theme="dark"] .mic-panel.recording {
        background: rgba(239, 83, 80, 0.15);
        border-color: #ef5350;
      }

      [data-theme="dark"] .mic-button {
        background: linear-gradient(135deg, #42a5f5, #1976d2);
        box-shadow: 0 4px 15px rgba(66, 165, 245, 0.3);
      }

      [data-theme="dark"] .mic-button.recording {
        background: linear-gradient(135deg, #ef5350, #d32f2f);
      }

      [data-theme="dark"] .mic-status {
        color: #b0b0b0;
      }

      /* Dark mode transcript */
      [data-theme="dark"] .transcript-area {
        background: #252525;
        border-color: #404040;
        color: #e0e0e0;
      }

      [data-theme="dark"] .transcript-panel h3 {
        color: #e0e0e0;
      }

      [data-theme="dark"] .transcript-line.partial {
        background: rgba(100, 181, 246, 0.15);
        border-left-color: #64b5f6;
        color: #64b5f6;
      }

      [data-theme="dark"] .transcript-line.final {
        background: rgba(102, 187, 106, 0.15);
        border-left-color: #66bb6a;
        color: #66bb6a;
      }

      [data-theme="dark"] .transcript-line.coach {
        background: rgba(186, 104, 200, 0.15);
        border-left-color: #ba68c8;
        color: #ba68c8;
      }

      /* Dark mode buttons */
      [data-theme="dark"] .btn-primary {
        background: linear-gradient(135deg, #42a5f5, #1976d2);
        box-shadow: 0 4px 15px rgba(66, 165, 245, 0.2);
      }

      [data-theme="dark"] .btn-secondary {
        background: #424242;
        color: #e0e0e0;
      }

      [data-theme="dark"] .btn:hover {
        box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
      }

      /* Dark mode status indicators */
      [data-theme="dark"] .status-bar {
        background: rgba(255, 255, 255, 0.05);
        color: #b0b0b0;
      }

      [data-theme="dark"] .status-dot.connected {
        background: #4caf50;
        box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
      }

      [data-theme="dark"] .status-dot.processing {
        background: #ff9800;
      }

      [data-theme="dark"] .status-dot {
        background: #f44336;
      }

      /* Dark mode corrections */
      [data-theme="dark"] .correction-chip {
        background: linear-gradient(135deg, #ff7043, #ff5722);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      [data-theme="dark"] .correction-chip:hover {
        background: linear-gradient(135deg, #ff8a65, #ff6f00);
        box-shadow: 0 4px 12px rgba(255, 112, 67, 0.4);
      }

      [data-theme="dark"] .correction-details {
        background: #333333;
        border-color: #555555;
        color: #e0e0e0;
      }

      /* Dark mode enhanced corrections */
      [data-theme="dark"] .correction-chip-enhanced {
        background: linear-gradient(135deg, #ff7043, #ff5722);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.2);
      }

      [data-theme="dark"] .correction-details-enhanced {
        background: linear-gradient(135deg, #424242 0%, #303030 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      /* Dark mode drills */
      [data-theme="dark"] .drills-section {
        background: rgba(255, 193, 7, 0.15);
        border-left-color: #ffc107;
      }

      [data-theme="dark"] .drill-item {
        background: #2a2a2a;
        border-color: #555555;
        color: #e0e0e0;
      }

      [data-theme="dark"] .drill-answer {
        color: #66bb6a;
      }

      /* Dark mode voice selector */
      [data-theme="dark"] .voice-selector {
        background: rgba(66, 165, 245, 0.1);
        border-color: rgba(66, 165, 245, 0.3);
      }

      [data-theme="dark"] .voice-selector label {
        color: #64b5f6;
      }

      [data-theme="dark"] .voice-select {
        background: #2a2a2a;
        color: #e0e0e0;
        border-color: rgba(66, 165, 245, 0.3);
      }

      [data-theme="dark"] .voice-select:hover {
        border-color: #64b5f6;
        box-shadow: 0 2px 8px rgba(66, 165, 245, 0.3);
      }

      [data-theme="dark"] .voice-select:focus {
        border-color: #64b5f6;
        box-shadow: 0 0 0 3px rgba(66, 165, 245, 0.2);
      }

      /* Dark mode mic level bar */
      [data-theme="dark"] .mic-level {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }

      [data-theme="dark"] .mic-level-bar {
        box-shadow: 0 0 6px rgba(100, 181, 246, 0.5);
      }

      /* Dark mode error highlighting */
      [data-theme="dark"] .error-highlight {
        filter: brightness(1.2);
      }

      [data-theme="dark"] .error-tooltip {
        background-color: #424242;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      [data-theme="dark"] .error-tooltip::after {
        border-color: #424242 transparent transparent transparent;
      }

      /* Dark mode toast notifications */
      [data-theme="dark"] .toast-notification {
        background: #333333;
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      [data-theme="dark"] .toast-close {
        color: #b0b0b0;
      }

      [data-theme="dark"] .toast-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      /* Smooth theme transition */
      body, .app-container, .mic-panel, .transcript-area, .btn, .status-bar,
      .correction-chip, .correction-details, .drills-section, .drill-item,
      .toast-notification, .theme-toggle-btn {
        transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease, 
                   box-shadow 0.3s ease, background-color 0.3s ease;
      }

      /* Reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        .theme-icon.switching {
          animation: none;
        }
        
        body, .app-container, .mic-panel, .transcript-area, .btn, .status-bar,
        .correction-chip, .correction-details, .drills-section, .drill-item,
        .toast-notification, .theme-toggle-btn {
          transition: none;
        }
      }

      /* Mobile responsive theme toggle */
      @media (max-width: 768px) {
        .theme-toggle-container {
          top: 0.5rem;
          right: 0.5rem;
        }
        
        .theme-toggle-btn {
          width: 42px;
          height: 42px;
        }
        
        .theme-icon {
          font-size: 1.2rem;
        }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Keyboard shortcut (Ctrl/Cmd + D)
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        this.toggleTheme();
      }
    });

    // Listen for storage changes (sync across tabs)
    window.addEventListener('storage', (event) => {
      if (event.key === 'dark-mode-preference') {
        const newPreference = event.newValue === 'true';
        this.isDarkMode = newPreference;
        this.applyTheme(newPreference, false);
        this.updateToggleIcon();
      }
    });
  }

  /**
   * Watch for system theme changes
   */
  watchSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      mediaQuery.addEventListener('change', (event) => {
        // Only auto-switch if user hasn't set a preference
        if (!this.hasStoredPreference()) {
          this.isDarkMode = event.matches;
          this.applyTheme(this.isDarkMode, true);
          this.updateToggleIcon();
        }
      });
    }
  }

  /**
   * Toggle between dark and light themes
   */
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme(this.isDarkMode, true);
    this.updateToggleIcon();
    this.storePreference(this.isDarkMode);

    // Show notification
    this.showNotification(`Switched to ${this.isDarkMode ? 'dark' : 'light'} mode`, 'info');

    // Track theme preference
    this.trackThemeChange();
  }

  /**
   * Apply theme to the document
   * @param {boolean} isDark - Whether to apply dark theme
   * @param {boolean} animate - Whether to animate the transition
   */
  applyTheme(isDark, animate = true) {
    const html = document.documentElement;

    if (animate && this.themeIcon) {
      this.themeIcon.classList.add('switching');
      setTimeout(() => {
        this.themeIcon?.classList.remove('switching');
      }, 500);
    }

    if (isDark) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }

    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(isDark);

    // Dispatch theme change event for other components
    document.dispatchEvent(
      new CustomEvent('themechange', {
        detail: { isDark, theme: isDark ? 'dark' : 'light' },
      })
    );
  }

  /**
   * Update the toggle button icon
   */
  updateToggleIcon() {
    if (!this.themeIcon) return;

    this.themeIcon.textContent = this.isDarkMode ? '☀️' : '🌙';

    if (this.toggleButton) {
      this.toggleButton.title = `Switch to ${this.isDarkMode ? 'light' : 'dark'} mode (Ctrl/Cmd+D)`;
    }
  }

  /**
   * Update meta theme-color for mobile browsers
   * @param {boolean} isDark - Whether dark theme is active
   */
  updateMetaThemeColor(isDark) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    metaThemeColor.content = isDark ? '#1a1a2e' : '#667eea';
  }

  /**
   * Get stored theme preference from localStorage
   * @returns {boolean} Stored preference or system preference
   */
  getStoredPreference() {
    try {
      const stored = localStorage.getItem('dark-mode-preference');
      if (stored !== null) {
        return stored === 'true';
      }
    } catch (_error) {
      console.warn('Failed to read theme preference from localStorage:', _error);
    }

    // Fallback to system preference
    return this.getSystemPreference();
  }

  /**
   * Check if user has stored a theme preference
   * @returns {boolean} Whether preference is stored
   */
  hasStoredPreference() {
    try {
      return localStorage.getItem('dark-mode-preference') !== null;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get system theme preference
   * @returns {boolean} System dark mode preference
   */
  getSystemPreference() {
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  /**
   * Store theme preference in localStorage
   * @param {boolean} isDark - Theme preference to store
   */
  storePreference(isDark) {
    try {
      localStorage.setItem('dark-mode-preference', isDark.toString());
    } catch (_error) {
      console.warn('Failed to store theme preference in localStorage:', _error);
    }
  }

  /**
   * Show notification for theme change
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   */
  showNotification(message, type = 'info') {
    // Use existing toast system if available
    if (window.showToast) {
      window.showToast(message, type);
    } else if (window.enhancedCorrections) {
      window.enhancedCorrections.showNotification(message, type);
    } else {
      console.log(`Theme: ${message}`);
    }
  }

  /**
   * Track theme change for analytics
   */
  trackThemeChange() {
    const event = {
      action: 'theme_change',
      theme: this.isDarkMode ? 'dark' : 'light',
      timestamp: Date.now(),
      userAgent: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
    };

    console.log('Theme change tracked:', event);
    // Could send to analytics API
  }

  /**
   * Get current theme information
   * @returns {Object} Theme information
   */
  getThemeInfo() {
    return {
      isDarkMode: this.isDarkMode,
      theme: this.isDarkMode ? 'dark' : 'light',
      hasStoredPreference: this.hasStoredPreference(),
      systemPreference: this.getSystemPreference(),
      supportsSystemDetection: !!window.matchMedia,
    };
  }

  /**
   * Force set theme without storing preference
   * @param {boolean} isDark - Theme to set
   */
  forceTheme(isDark) {
    this.isDarkMode = isDark;
    this.applyTheme(isDark, true);
    this.updateToggleIcon();
  }

  /**
   * Reset to system preference
   */
  resetToSystemPreference() {
    const systemPref = this.getSystemPreference();
    this.isDarkMode = systemPref;
    this.applyTheme(systemPref, true);
    this.updateToggleIcon();

    // Remove stored preference to follow system
    try {
      localStorage.removeItem('dark-mode-preference');
    } catch (_error) {
      console.warn('Failed to remove theme preference from localStorage:', _error);
    }

    this.showNotification('Reset to follow system theme', 'info');
  }

  /**
   * Destroy dark mode system (cleanup)
   */
  destroy() {
    if (this.toggleButton) {
      this.toggleButton.remove();
    }

    // Remove theme attribute
    document.documentElement.removeAttribute('data-theme');

    // Clean up event listeners would require storing references
    console.log('DarkModeSystem destroyed');
  }
}

// Auto-initialize when loaded (skip in test environments)
if (typeof document !== 'undefined' && !globalThis.process?.env?.NODE_ENV?.includes('test')) {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.darkModeSystem) {
      window.darkModeSystem = new DarkModeSystem();
    }
  });

  // Also initialize immediately if DOM already loaded
  if (document.readyState === 'loading') {
    // DOM is still loading
  } else {
    // DOM is already loaded
    if (!window.darkModeSystem) {
      window.darkModeSystem = new DarkModeSystem();
    }
  }
}

export default DarkModeSystem;
