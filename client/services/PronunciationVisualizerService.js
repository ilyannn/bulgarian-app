/**
 * Pronunciation Visualization Service
 *
 * Handles visual feedback for pronunciation scoring including:
 * - Phoneme-level color coding
 * - Waveform visualization with timing markers
 * - Pronunciation heatmaps
 * - Interactive practice feedback
 */

export class PronunciationVisualizerService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.currentAnalysis = null;
    this.isVisualizationActive = false;

    // Color scheme for pronunciation scores
    this.scoreColors = {
      excellent: '#22c55e', // Green - 0.8+
      good: '#84cc16', // Light green - 0.6-0.8
      okay: '#eab308', // Yellow - 0.4-0.6
      poor: '#f97316', // Orange - 0.2-0.4
      critical: '#ef4444', // Red - 0.0-0.2
    };

    // Phoneme difficulty colors
    this.difficultyColors = {
      1: '#e5e7eb', // Gray - Easy
      2: '#fbbf24', // Yellow - Medium
      3: '#f97316', // Orange - Hard
      4: '#ef4444', // Red - Very hard
    };
  }

  /**
   * Initialize visualization canvas and context
   * @param {HTMLCanvasElement} canvas - Canvas element for visualization
   */
  initialize(canvas) {
    if (!canvas) {
      console.error('Canvas element required for pronunciation visualization');
      return false;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Set up responsive canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    console.log('Pronunciation visualizer initialized');
    return true;
  }

  /**
   * Resize canvas to match container dimensions
   */
  resizeCanvas() {
    if (!this.canvas) return;

    const container = this.canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = Math.max(200, rect.height || 200);

    // Redraw if we have analysis data
    if (this.currentAnalysis) {
      this.drawVisualization();
    }
  }

  /**
   * Display pronunciation analysis results
   * @param {Object} analysis - Pronunciation analysis from API
   */
  displayAnalysis(analysis) {
    if (!this.canvas || !this.ctx) {
      console.warn('Canvas not initialized for pronunciation visualization');
      return;
    }

    this.currentAnalysis = analysis;
    this.isVisualizationActive = true;

    // Clear previous visualization
    this.clearCanvas();

    // Draw the visualization
    this.drawVisualization();

    // Update any associated UI elements
    this.updateScoreDisplay(analysis.overall_score);
    this.updateSuggestions(analysis.suggestions);
  }

  /**
   * Draw the complete pronunciation visualization
   */
  drawVisualization() {
    if (!this.currentAnalysis || !this.ctx) return;

    this.clearCanvas();

    const analysis = this.currentAnalysis;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw timeline visualization
    this.drawTimeline(analysis.visual_feedback.timeline, width, height * 0.4);

    // Draw phoneme heatmap
    this.drawPhonemeHeatmap(
      analysis.visual_feedback.phoneme_heatmap,
      width,
      height * 0.3,
      height * 0.5
    );

    // Draw overall score indicator
    this.drawScoreIndicator(analysis.overall_score, width - 100, 20);
  }

  /**
   * Draw timeline with word-level pronunciation scores
   * @param {Array} timeline - Timeline data from analysis
   * @param {number} width - Canvas width
   * @param {number} height - Timeline height
   */
  drawTimeline(timeline, width, height) {
    if (!timeline || timeline.length === 0) return;

    const ctx = this.ctx;
    const startY = 10;
    const timelineHeight = height - 20;

    // Draw timeline background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, startY, width, timelineHeight);

    // Calculate time scale
    const totalDuration = Math.max(...timeline.map((item) => item.end));
    const timeScale = width / totalDuration;

    // Draw word segments
    timeline.forEach((item, _index) => {
      const startX = item.start * timeScale;
      const segmentWidth = (item.end - item.start) * timeScale;

      // Color based on pronunciation score
      ctx.fillStyle = this.getScoreColor(item.score);
      ctx.fillRect(startX, startY, segmentWidth, timelineHeight);

      // Add text label if segment is wide enough
      if (segmentWidth > 60) {
        ctx.fillStyle = '#1f2937';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.text, startX + segmentWidth / 2, startY + timelineHeight / 2 + 4);
      }

      // Add score overlay
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${(item.score * 100).toFixed(0)}%`,
        startX + segmentWidth / 2,
        startY + timelineHeight - 5
      );
    });

    // Draw timeline axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    for (let i = 0; i <= totalDuration; i += Math.max(1, Math.floor(totalDuration / 10))) {
      const x = i * timeScale;
      ctx.fillText(`${i.toFixed(1)}s`, x, startY + timelineHeight + 15);
    }
  }

  /**
   * Draw phoneme difficulty heatmap
   * @param {Object} heatmap - Phoneme heatmap data
   * @param {number} width - Canvas width
   * @param {number} height - Heatmap height
   * @param {number} startY - Starting Y position
   */
  drawPhonemeHeatmap(heatmap, width, height, startY) {
    if (!heatmap || Object.keys(heatmap).length === 0) return;

    const ctx = this.ctx;
    const phonemes = Object.keys(heatmap);
    const cellWidth = Math.min(60, width / phonemes.length);
    const cellHeight = height - 20;

    // Draw heatmap title
    ctx.fillStyle = '#374151';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Phoneme Pronunciation Scores', 10, startY - 5);

    // Draw phoneme cells
    phonemes.forEach((phoneme, index) => {
      const data = heatmap[phoneme];
      const x = index * cellWidth + 10;
      const y = startY;

      // Draw cell background with score color
      ctx.fillStyle = data.color || this.getScoreColor(data.average_score);
      ctx.fillRect(x, y, cellWidth - 2, cellHeight);

      // Draw phoneme label
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(phoneme, x + cellWidth / 2, y + cellHeight / 2 - 10);

      // Draw score
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.fillText(
        `${(data.average_score * 100).toFixed(0)}%`,
        x + cellWidth / 2,
        y + cellHeight / 2 + 10
      );

      // Draw count
      ctx.font = '10px Arial';
      ctx.fillText(`(${data.count})`, x + cellWidth / 2, y + cellHeight - 10);
    });
  }

  /**
   * Draw overall score indicator
   * @param {number} score - Overall pronunciation score (0.0-1.0)
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  drawScoreIndicator(score, x, y) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const radius = 30;

    // Draw background circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#f3f4f6';
    ctx.fill();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw score arc
    const endAngle = -Math.PI / 2 + score * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(x, y, radius - 5, -Math.PI / 2, endAngle);
    ctx.strokeStyle = this.getScoreColor(score);
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw score text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${(score * 100).toFixed(0)}%`, x, y + 3);
  }

  /**
   * Get color based on pronunciation score
   * @param {number} score - Score from 0.0 to 1.0
   * @returns {string} Color hex code
   */
  getScoreColor(score) {
    if (score >= 0.8) return this.scoreColors.excellent;
    if (score >= 0.6) return this.scoreColors.good;
    if (score >= 0.4) return this.scoreColors.okay;
    if (score >= 0.2) return this.scoreColors.poor;
    return this.scoreColors.critical;
  }

  /**
   * Get color based on phoneme difficulty
   * @param {number} difficulty - Difficulty level (1-4)
   * @returns {string} Color hex code
   */
  getDifficultyColor(difficulty) {
    return this.difficultyColors[difficulty] || this.difficultyColors[2];
  }

  /**
   * Update score display in UI
   * @param {number} score - Overall score
   */
  updateScoreDisplay(score) {
    const scoreElement = document.getElementById('pronunciation-score');
    if (scoreElement) {
      scoreElement.textContent = `${(score * 100).toFixed(0)}%`;
      scoreElement.style.color = this.getScoreColor(score);
    }
  }

  /**
   * Update suggestions display
   * @param {Array} suggestions - Array of suggestion strings
   */
  updateSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('pronunciation-suggestions');
    if (!suggestionsContainer || !suggestions) return;

    // Clear existing suggestions
    suggestionsContainer.innerHTML = '';

    // Add new suggestions
    suggestions.forEach((suggestion, _index) => {
      const suggestionElement = document.createElement('div');
      suggestionElement.className = 'pronunciation-suggestion';
      suggestionElement.innerHTML = `
        <div class="suggestion-icon">💡</div>
        <div class="suggestion-text">${this.escapeHtml(suggestion)}</div>
      `;
      suggestionsContainer.appendChild(suggestionElement);
    });
  }

  /**
   * Create interactive phoneme practice display
   * @param {Array} problemPhonemes - List of problematic phonemes
   * @returns {HTMLElement} Practice display element
   */
  createPhonemePracticeDisplay(problemPhonemes) {
    const container = document.createElement('div');
    container.className = 'phoneme-practice-container';

    if (!problemPhonemes || problemPhonemes.length === 0) {
      container.innerHTML = `
        <div class="practice-message success">
          <div class="practice-icon">🎉</div>
          <div class="practice-text">Great job! No problematic phonemes detected.</div>
        </div>
      `;
      return container;
    }

    // Create header
    const header = document.createElement('div');
    header.className = 'practice-header';
    header.innerHTML = `
      <h3>Focus on These Sounds</h3>
      <p>Practice these Bulgarian phonemes for better pronunciation:</p>
    `;
    container.appendChild(header);

    // Create phoneme practice cards
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'phoneme-cards';

    problemPhonemes.forEach((phoneme) => {
      const card = this.createPhonemeCard(phoneme);
      cardsContainer.appendChild(card);
    });

    container.appendChild(cardsContainer);
    return container;
  }

  /**
   * Create a single phoneme practice card
   * @param {string} phoneme - Phoneme to practice
   * @returns {HTMLElement} Phoneme card element
   */
  createPhonemeCard(phoneme) {
    const card = document.createElement('div');
    card.className = 'phoneme-card';
    card.dataset.phoneme = phoneme;

    card.innerHTML = `
      <div class="phoneme-symbol">${this.escapeHtml(phoneme)}</div>
      <div class="phoneme-actions">
        <button class="btn btn-practice" onclick="window.startPhonemePractice('${phoneme}')">
          🎯 Practice
        </button>
        <button class="btn btn-examples" onclick="window.showPhonemeExamples('${phoneme}')">
          📝 Examples
        </button>
      </div>
    `;

    return card;
  }

  /**
   * Clear the canvas
   */
  clearCanvas() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Stop visualization and clean up
   */
  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isVisualizationActive = false;
    this.currentAnalysis = null;

    if (this.canvas) {
      this.clearCanvas();
    }
  }

  /**
   * Safely escape HTML content
   * @param {string} unsafe - Potentially unsafe string
   * @returns {string} HTML-escaped string
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
   * Export visualization as image
   * @returns {string} Data URL of canvas image
   */
  exportVisualization() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }
}

// Global functions for phoneme practice (called from generated HTML)
window.startPhonemePractice = async (phoneme) => {
  try {
    const response = await fetch(`/pronunciation/practice-words/${encodeURIComponent(phoneme)}`);
    if (!response.ok) throw new Error('Failed to get practice words');

    const data = await response.json();

    // Show practice words modal or interface
    if (window.voiceCoach?.showPhonemePractice) {
      window.voiceCoach.showPhonemePractice(phoneme, data.practice_words);
    } else {
      console.log('Practice words for', phoneme, ':', data.practice_words);
    }
  } catch (error) {
    console.error('Failed to start phoneme practice:', error);
  }
};

window.showPhonemeExamples = (phoneme) => {
  // Show examples modal or interface
  if (window.voiceCoach?.showPhonemeExamples) {
    window.voiceCoach.showPhonemeExamples(phoneme);
  } else {
    console.log('Show examples for phoneme:', phoneme);
  }
};

export const pronunciationVisualizer = new PronunciationVisualizerService();
