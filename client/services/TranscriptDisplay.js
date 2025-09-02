/**
 * Enhanced Transcript Display Service
 * Provides improved visual presentation of transcripts with:
 * - Chat-like bubbles for conversations
 * - Typing indicators for partial transcripts
 * - Confidence level visualization
 * - Smooth animations and transitions
 */
export class TranscriptDisplay {
  constructor() {
    this.transcriptArea = null;
    this.currentPartialBubble = null;
    this.confidenceThresholds = {
      high: 0.85,
      medium: 0.7,
      low: 0.5,
    };
    this.lastMessageTimestamp = null;
    this.shouldGroupMessages = false;
  }

  /**
   * Safely escape HTML content to prevent XSS attacks
   * @param {string} unsafe - Potentially unsafe HTML string
   * @returns {string} - HTML-escaped safe string
   */
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Create a text node or HTML element safely
   * @param {string} text - Text content
   * @param {string} tagName - HTML tag name (optional)
   * @param {string} className - CSS class name (optional)
   * @returns {Node} - Safe DOM node
   */
  createSafeElement(text, tagName = 'span', className = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text; // Use textContent instead of innerHTML
    return element;
  }

  /**
   * Safely highlight errors in text using DOM manipulation instead of innerHTML
   * @param {HTMLElement} container - Container element to populate
   * @param {string} text - Original text
   * @param {Array} errors - Array of error objects
   */
  highlightErrorsSafe(container, text, errors) {
    if (!errors || errors.length === 0) {
      container.textContent = text;
      return;
    }

    // Sort errors by position to avoid overlapping
    const sortedErrors = [...errors].sort((a, b) => (a.position || 0) - (b.position || 0));

    let currentIndex = 0;

    for (const error of sortedErrors) {
      if (!error.before || typeof error.before !== 'string') continue;

      // Find the error text in the remaining text
      const errorIndex = text.indexOf(error.before, currentIndex);
      if (errorIndex === -1) continue;

      // Add text before the error
      if (errorIndex > currentIndex) {
        const beforeText = text.substring(currentIndex, errorIndex);
        container.appendChild(document.createTextNode(beforeText));
      }

      // Create error highlight span with safe attributes
      const errorSpan = document.createElement('span');
      errorSpan.className = `error-highlight ${this.getErrorClass(error.error_type)}`;
      errorSpan.textContent = error.before; // Safe text insertion

      // Safe tooltip using dataset (no XSS risk)
      errorSpan.dataset.tooltip = `${this.escapeHtml(error.error_type)}: ${this.escapeHtml(error.before)} → ${this.escapeHtml(error.after)}`;

      container.appendChild(errorSpan);

      currentIndex = errorIndex + error.before.length;
    }

    // Add remaining text after the last error
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      container.appendChild(document.createTextNode(remainingText));
    }
  }

  /**
   * Initialize the transcript display service
   * @param {HTMLElement} transcriptArea - The container element for transcripts
   */
  init(transcriptArea) {
    this.transcriptArea = transcriptArea;
    this.setupStyles();
    this.clearTranscripts();
  }

  /**
   * Setup enhanced styles for transcript display
   */
  setupStyles() {
    if (document.getElementById('transcript-display-styles')) return;

    const style = document.createElement('style');
    style.id = 'transcript-display-styles';
    style.textContent = `
      /* Chat-like transcript bubbles */
      .transcript-bubble {
        display: flex;
        margin-bottom: 1rem;
        animation: slideIn 0.3s ease;
        position: relative;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .transcript-bubble.user {
        justify-content: flex-end;
      }

      .transcript-bubble.coach {
        justify-content: flex-start;
      }

      .bubble-content {
        max-width: 70%;
        padding: 0.75rem 1rem;
        border-radius: 18px;
        position: relative;
        word-wrap: break-word;
      }

      .transcript-bubble.user .bubble-content {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .transcript-bubble.coach .bubble-content {
        background: #f0f2f5;
        color: #1c1e21;
        border-bottom-left-radius: 4px;
      }

      /* Dark mode support */
      .dark-mode .transcript-bubble.coach .bubble-content {
        background: #3a3b3c;
        color: #e4e6eb;
      }

      /* Partial transcript with typing indicator */
      .transcript-bubble.partial .bubble-content {
        background: rgba(102, 126, 234, 0.1);
        border: 2px dashed #667eea;
        color: #667eea;
      }

      .typing-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
      }

      .typing-dot {
        width: 6px;
        height: 6px;
        background: #667eea;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        30% {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Confidence indicators */
      .confidence-indicator {
        position: absolute;
        bottom: -20px;
        font-size: 0.75rem;
        color: #999;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .transcript-bubble.user .confidence-indicator {
        right: 0;
      }

      .confidence-bar {
        display: inline-flex;
        gap: 2px;
        align-items: center;
      }

      .confidence-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #ddd;
        transition: all 0.3s ease;
      }

      .confidence-dot.filled {
        background: currentColor;
        transform: scale(1.2);
      }

      .confidence-high {
        color: #4caf50;
      }

      .confidence-medium {
        color: #ff9800;
      }

      .confidence-low {
        color: #f44336;
      }

      /* Timestamp and metadata */
      .bubble-metadata {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
      }

      .transcript-bubble.coach .bubble-metadata {
        color: #999;
      }

      /* Message grouping */
      .transcript-bubble.grouped {
        margin-bottom: 0.25rem;
      }

      .transcript-bubble.grouped .bubble-content {
        border-radius: 18px;
      }

      .transcript-bubble.grouped.first .bubble-content {
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;
      }

      .transcript-bubble.grouped.middle .bubble-content {
        border-radius: 4px 18px 18px 4px;
      }

      .transcript-bubble.grouped.last .bubble-content {
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
      }

      /* Scroll to bottom button */
      .scroll-to-bottom {
        position: absolute;
        bottom: 10px;
        right: 10px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #667eea;
        color: white;
        border: none;
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }

      .scroll-to-bottom:hover {
        background: #764ba2;
        transform: scale(1.1);
      }

      .scroll-to-bottom.visible {
        display: flex;
      }

      /* Empty state */
      .transcript-empty {
        text-align: center;
        color: #999;
        padding: 3rem;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Clear all transcripts
   */
  clearTranscripts() {
    if (this.transcriptArea) {
      this.transcriptArea.innerHTML = `
        <div class="transcript-empty">
          Start speaking to see your conversation here...
        </div>
      `;
    }
    this.currentPartialBubble = null;
    this.lastMessageTimestamp = null;
  }

  /**
   * Update partial transcript with typing indicator
   * @param {string} text - Partial transcript text
   * @param {number} confidence - Confidence score (0-1)
   */
  updatePartialTranscript(text, confidence = 0.7) {
    // Remove empty state if exists
    const emptyState = this.transcriptArea.querySelector('.transcript-empty');
    if (emptyState) {
      emptyState.remove();
    }

    // Create or update partial bubble
    if (!this.currentPartialBubble) {
      this.currentPartialBubble = document.createElement('div');
      this.currentPartialBubble.className = 'transcript-bubble user partial';

      const bubbleContent = document.createElement('div');
      bubbleContent.className = 'bubble-content';

      this.currentPartialBubble.appendChild(bubbleContent);
      this.transcriptArea.appendChild(this.currentPartialBubble);
    }

    const bubbleContent = this.currentPartialBubble.querySelector('.bubble-content');

    // Clear existing content and create safe text element
    bubbleContent.innerHTML = ''; // Clear previous content
    const textSpan = this.createSafeElement(text, 'span', 'bg-text');
    bubbleContent.appendChild(textSpan);

    // Add typing indicator if text is being formed
    if (text.length > 0) {
      const typingIndicator = document.createElement('span');
      typingIndicator.className = 'typing-indicator';

      // Create three typing dots
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'typing-dot';
        typingIndicator.appendChild(dot);
      }

      bubbleContent.appendChild(typingIndicator);
    }

    // Add confidence indicator if available
    if (confidence !== undefined) {
      this.addConfidenceIndicator(this.currentPartialBubble, confidence, true);
    }

    this.scrollToBottom();
  }

  /**
   * Add finalized transcript as a bubble
   * @param {string} text - Final transcript text
   * @param {number} confidence - Confidence score (0-1)
   * @param {Array} errors - Detected errors for highlighting
   */
  addFinalTranscript(text, confidence = 0.85, errors = []) {
    // Remove empty state if exists
    const emptyState = this.transcriptArea.querySelector('.transcript-empty');
    if (emptyState) {
      emptyState.remove();
    }

    // Remove partial bubble
    if (this.currentPartialBubble) {
      this.currentPartialBubble.remove();
      this.currentPartialBubble = null;
    }

    // Create final bubble
    const bubble = document.createElement('div');
    bubble.className = 'transcript-bubble user';

    // Check if should group with previous message
    if (this.shouldGroupWithPrevious('user')) {
      bubble.classList.add('grouped');
      this.updatePreviousGrouping('user');
    }

    const bubbleContent = document.createElement('div');
    bubbleContent.className = 'bubble-content';

    // Create text span safely
    const textSpan = document.createElement('span');
    textSpan.className = 'bg-text';

    // Highlight errors if any, using safe DOM manipulation
    if (errors.length > 0) {
      this.highlightErrorsSafe(textSpan, text, errors);
    } else {
      textSpan.textContent = text; // Safe text insertion
    }

    bubbleContent.appendChild(textSpan);

    // Add metadata
    const metadata = document.createElement('div');
    metadata.className = 'bubble-metadata';
    metadata.innerHTML = `
      <span class="timestamp">${this.getTimestamp()}</span>
    `;
    bubbleContent.appendChild(metadata);

    bubble.appendChild(bubbleContent);

    // Add confidence indicator
    this.addConfidenceIndicator(bubble, confidence);

    this.transcriptArea.appendChild(bubble);
    this.updateLastMessageTimestamp('user');
    this.scrollToBottom();
  }

  /**
   * Add coach response as a bubble
   * @param {Object} payload - Coach response payload
   */
  addCoachResponse(payload) {
    // Remove empty state if exists
    const emptyState = this.transcriptArea.querySelector('.transcript-empty');
    if (emptyState) {
      emptyState.remove();
    }

    const bubble = document.createElement('div');
    bubble.className = 'transcript-bubble coach';

    // Check if should group with previous message
    if (this.shouldGroupWithPrevious('coach')) {
      bubble.classList.add('grouped');
      this.updatePreviousGrouping('coach');
    }

    const bubbleContent = document.createElement('div');
    bubbleContent.className = 'bubble-content';

    // Create safe response text element
    const responseSpan = this.createSafeElement(payload.reply_bg, 'span', 'bg-text bg-response');
    bubbleContent.appendChild(responseSpan);

    // Add metadata
    const metadata = document.createElement('div');
    metadata.className = 'bubble-metadata';
    metadata.innerHTML = `
      <span class="timestamp">${this.getTimestamp()}</span>
    `;
    bubbleContent.appendChild(metadata);

    bubble.appendChild(bubbleContent);
    this.transcriptArea.appendChild(bubble);

    // Add grammar chips if corrections exist
    if (payload.corrections && payload.corrections.length > 0 && window.grammarChipsUI) {
      window.grammarChipsUI.createChips(payload.corrections, bubble);
    }

    this.updateLastMessageTimestamp('coach');
    this.scrollToBottom();
  }

  /**
   * Add confidence indicator to a bubble
   * @param {HTMLElement} bubble - The bubble element
   * @param {number} confidence - Confidence score (0-1)
   * @param {boolean} isPartial - Whether this is a partial transcript
   */
  addConfidenceIndicator(bubble, confidence, isPartial = false) {
    // Remove existing indicator if any
    const existing = bubble.querySelector('.confidence-indicator');
    if (existing) {
      existing.remove();
    }

    const level = this.getConfidenceLevel(confidence);
    const dots = this.getConfidenceDots(confidence);

    const indicator = document.createElement('div');
    indicator.className = `confidence-indicator confidence-${level}`;

    const label = isPartial ? 'listening' : 'confidence';

    indicator.innerHTML = `
      <span class="confidence-bar">
        ${dots
          .map((filled) => `<span class="confidence-dot ${filled ? 'filled' : ''}"></span>`)
          .join('')}
      </span>
      <span>${label}: ${Math.round(confidence * 100)}%</span>
    `;

    bubble.appendChild(indicator);
  }

  /**
   * Get confidence level based on score
   * @param {number} confidence - Confidence score (0-1)
   * @returns {string} Level: 'high', 'medium', or 'low'
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.confidenceThresholds.high) return 'high';
    if (confidence >= this.confidenceThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Get confidence dots visualization
   * @param {number} confidence - Confidence score (0-1)
   * @returns {Array<boolean>} Array of 5 booleans for dot filling
   */
  getConfidenceDots(confidence) {
    const numDots = 5;
    const filledDots = Math.round(confidence * numDots);
    return Array(numDots)
      .fill(false)
      .map((_, i) => i < filledDots);
  }

  /**
   * Check if message should be grouped with previous
   * @param {string} type - 'user' or 'coach'
   * @returns {boolean}
   */
  shouldGroupWithPrevious(type) {
    const lastBubble = this.transcriptArea.querySelector('.transcript-bubble:last-child');
    if (!lastBubble) return false;

    const issameSender =
      (type === 'user' && lastBubble.classList.contains('user')) ||
      (type === 'coach' && lastBubble.classList.contains('coach'));

    // Group if same sender and within 30 seconds
    const timeDiff = Date.now() - (this.lastMessageTimestamp || 0);
    return issameSender && timeDiff < 30000;
  }

  /**
   * Update previous message grouping class
   * @param {string} type - 'user' or 'coach'
   */
  updatePreviousGrouping(type) {
    const bubbles = this.transcriptArea.querySelectorAll(`.transcript-bubble.${type}`);
    if (bubbles.length < 2) return;

    const prevBubble = bubbles[bubbles.length - 1];
    if (!prevBubble.classList.contains('grouped')) {
      prevBubble.classList.add('grouped', 'first');
    } else if (prevBubble.classList.contains('last')) {
      prevBubble.classList.remove('last');
      prevBubble.classList.add('middle');
    }
  }

  /**
   * Update last message timestamp
   * @param {string} _type - 'user' or 'coach' (unused but kept for future use)
   */
  updateLastMessageTimestamp(_type) {
    this.lastMessageTimestamp = Date.now();
  }

  /**
   * Get formatted timestamp
   * @returns {string}
   */
  getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /**
   * Highlight errors in text
   * @param {string} text - Text to highlight
   * @param {Array} errors - Array of error objects
   * @returns {string} HTML with highlighted errors
   */
  /**
   * @deprecated This method has XSS vulnerabilities. Use highlightErrorsSafe instead.
   *
   * Legacy method kept for backwards compatibility but made safe.
   * Returns plain text to avoid XSS attacks.
   */
  highlightErrors(text, _errors) {
    console.warn(
      'highlightErrors is deprecated due to XSS vulnerabilities. Use highlightErrorsSafe instead.'
    );

    // Return plain text to prevent XSS
    if (!text || typeof text !== 'string') return '';
    return this.escapeHtml(text);
  }

  /**
   * Get error class based on type
   * @param {string} errorType - Type of error
   * @returns {string} CSS class name
   */
  getErrorClass(errorType) {
    const errorClasses = {
      grammar: 'error-grammar',
      agreement: 'error-agreement',
      article: 'error-article',
      case: 'error-case',
      tense: 'error-tense',
      spelling: 'error-spelling',
      vocabulary: 'error-vocabulary',
    };
    return errorClasses[errorType] || 'error-general';
  }

  /**
   * Scroll to bottom of transcript area
   */
  scrollToBottom() {
    if (this.transcriptArea) {
      this.transcriptArea.scrollTop = this.transcriptArea.scrollHeight;
    }
  }

  /**
   * Show scroll to bottom button if needed
   */
  checkScrollButton() {
    const button = this.transcriptArea.querySelector('.scroll-to-bottom');
    if (!button) {
      const scrollBtn = document.createElement('button');
      scrollBtn.className = 'scroll-to-bottom';
      scrollBtn.innerHTML = '↓';
      scrollBtn.onclick = () => this.scrollToBottom();
      this.transcriptArea.appendChild(scrollBtn);
    }

    const isNearBottom =
      this.transcriptArea.scrollHeight -
        this.transcriptArea.scrollTop -
        this.transcriptArea.clientHeight <
      100;

    button.classList.toggle('visible', !isNearBottom);
  }
}

// Export for use in main.js
window.TranscriptDisplay = TranscriptDisplay;
