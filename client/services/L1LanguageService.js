/**
 * L1LanguageService - Manages native language selection and contrast notes
 *
 * This service handles:
 * - L1 language preference storage (localStorage)
 * - API communication for language settings
 * - Dynamic contrast note filtering based on selected L1
 * - Font class management for proper typography
 */
// Constants for supported languages
const SUPPORTED_LANGUAGES = ['PL', 'RU', 'UK', 'SR'];

const LANGUAGE_NAMES = {
  PL: {
    native: 'Polski',
    english: 'Polish',
  },
  RU: {
    native: 'Русский',
    english: 'Russian',
  },
  UK: {
    native: 'Українська',
    english: 'Ukrainian',
  },
  SR: {
    native: 'Српски',
    english: 'Serbian',
  },
};

export class L1LanguageService {
  constructor() {
    this.STORAGE_KEY = 'bgvc_l1_preference';
    this.currentL1 = this.loadL1Preference();
    this.supportedLanguages = SUPPORTED_LANGUAGES;
    this.languageNames = LANGUAGE_NAMES;
    this.initialized = false;
  }

  /**
   * Initialize the service and fetch configuration from backend
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const response = await fetch('/api/config');
      const config = await response.json();

      // Use server config if available, otherwise use constants
      this.supportedLanguages = config.supported_languages || SUPPORTED_LANGUAGES;
      // Server might provide updated names, but we use our constants as fallback

      // If no stored preference, use server default
      if (!this.currentL1) {
        this.currentL1 = config.l1_language || 'PL';
        this.saveL1Preference(this.currentL1);
      }

      this.initialized = true;
      this.applyFontClass();
    } catch (error) {
      console.error('Failed to initialize L1LanguageService:', error);
      // Already using constants as defaults
      this.initialized = true;
    }
  }

  /**
   * Load L1 preference from localStorage
   */
  loadL1Preference() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || null;
    } catch (error) {
      console.error('Failed to load L1 preference:', error);
      return null;
    }
  }

  /**
   * Save L1 preference to localStorage
   */
  saveL1Preference(language) {
    try {
      localStorage.setItem(this.STORAGE_KEY, language);
    } catch (error) {
      console.error('Failed to save L1 preference:', error);
    }
  }

  /**
   * Get current L1 language
   */
  getCurrentL1() {
    return this.currentL1 || 'PL';
  }

  /**
   * Set L1 language and update UI
   */
  async setL1Language(language) {
    if (!this.supportedLanguages?.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Update backend (session-based for now)
    try {
      const response = await fetch('/api/config/l1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ l1_language: language }),
      });

      if (!response.ok) {
        throw new Error('Failed to update L1 language on server');
      }
    } catch (error) {
      console.error('Failed to update L1 on server:', error);
      // Continue anyway - we can work with localStorage
    }

    this.currentL1 = language;
    this.saveL1Preference(language);
    this.applyFontClass();

    // Dispatch event for other components to react
    window.dispatchEvent(
      new CustomEvent('l1-language-changed', {
        detail: { language },
      })
    );
  }

  /**
   * Apply appropriate font class based on L1 language
   */
  applyFontClass() {
    const body = document.body;

    // Remove all L1 classes
    body.classList.remove('l1-pl', 'l1-ru', 'l1-uk', 'l1-sr');

    // Add current L1 class
    if (this.currentL1) {
      body.classList.add(`l1-${this.currentL1.toLowerCase()}`);
    }
  }

  /**
   * Create the language selector UI component
   */
  createLanguageSelector() {
    const container = document.createElement('div');
    container.className = 'l1-language-selector';

    const label = document.createElement('label');
    label.textContent = 'Native Language: ';
    label.htmlFor = 'l1-select';

    const select = document.createElement('select');
    select.id = 'l1-select';
    select.className = 'l1-select';

    // Add options
    if (this.supportedLanguages && this.languageNames) {
      for (const lang of this.supportedLanguages) {
        const option = document.createElement('option');
        option.value = lang;
        const names = this.languageNames[lang];
        // Display format: "Polski (Polish)"
        option.textContent = `${names.native} (${names.english})`;
        if (lang === this.currentL1) {
          option.selected = true;
        }
        select.appendChild(option);
      }
    }

    // Add change handler
    select.addEventListener('change', async (e) => {
      const newLang = e.target.value;
      await this.setL1Language(newLang);
      this.showLanguageChangedNotification(newLang);
    });

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  /**
   * Show notification when language is changed
   */
  showLanguageChangedNotification(language) {
    const notification = document.createElement('div');
    notification.className = 'l1-notification';
    const names = this.languageNames[language];
    notification.textContent = `Native language switched to ${names.native} (${names.english})`;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Filter contrast notes based on current L1
   * This will be used by grammar display components
   */
  filterContrastNotes(grammarItem) {
    if (!grammarItem) return null;

    const l1 = this.getCurrentL1();
    const contrastKey = `contrast_${l1}`;

    // Return L1-specific contrast if available
    if (grammarItem[contrastKey]) {
      return grammarItem[contrastKey];
    }

    // Fallback to general contrast note
    return grammarItem.contrast_note || null;
  }

  /**
   * Get language-specific CSS class for typography
   */
  getTypographyClass() {
    return `l1-${this.getCurrentL1().toLowerCase()}`;
  }
}

// Export singleton instance
export const l1LanguageService = new L1LanguageService();
