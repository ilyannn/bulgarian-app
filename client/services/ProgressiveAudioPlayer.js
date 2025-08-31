/**
 * Progressive Audio Player using MediaSource API
 * Enables streaming audio playback with lower perceived latency
 */
export class ProgressiveAudioPlayer {
  constructor() {
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.audioElement = null;
    this.fetchController = null;
    this.isStreaming = false;
    this.isPaused = false;
    this.bufferQueue = [];
    this.isUpdating = false;

    // Check MediaSource support
    this.isSupported = this.checkMediaSourceSupport();

    // Fallback audio element for unsupported browsers
    this.fallbackAudio = new Audio();

    // Event callbacks
    this.onPlayingCallback = null;
    this.onPausedCallback = null;
    this.onEndedCallback = null;
    this.onErrorCallback = null;

    // Buffer management
    this.minBufferSize = 4096; // 4KB minimum before starting playback
    this.targetBufferAhead = 2; // seconds to buffer ahead
  }

  checkMediaSourceSupport() {
    // Check if MediaSource API is available
    if (typeof MediaSource === 'undefined') {
      console.warn('MediaSource API not supported, using fallback');
      return false;
    }

    // Check for WAV support (audio/wav or audio/wave)
    const mimeTypes = ['audio/wav', 'audio/wave', 'audio/wav; codecs=1'];
    for (const mimeType of mimeTypes) {
      if (MediaSource.isTypeSupported(mimeType)) {
        this.supportedMimeType = mimeType;
        return true;
      }
    }

    console.warn('No supported MIME types for MediaSource, using fallback');
    return false;
  }

  /**
   * Load and stream audio from a URL
   * @param {string} url - The audio URL to stream
   * @returns {Promise<void>}
   */
  async loadAndStream(url) {
    if (!this.isSupported) {
      // Fallback to regular audio element
      return this.loadFallback(url);
    }

    try {
      // Clean up previous stream
      this.cleanup();

      // Create new MediaSource
      this.mediaSource = new MediaSource();
      this.audioElement = new Audio();
      this.audioElement.src = URL.createObjectURL(this.mediaSource);

      // Set up event listeners
      this.setupAudioEventListeners();

      // Wait for MediaSource to open
      await new Promise((resolve, reject) => {
        this.mediaSource.addEventListener('sourceopen', resolve, { once: true });
        this.mediaSource.addEventListener('error', reject, { once: true });
      });

      // Create source buffer
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.supportedMimeType);
      this.setupSourceBufferListeners();

      // Start fetching and streaming
      this.isStreaming = true;
      await this.fetchAndStream(url);
    } catch (error) {
      console.error('Progressive audio streaming failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      // Fall back to regular loading
      return this.loadFallback(url);
    }
  }

  /**
   * Fetch audio data and stream it progressively
   * @param {string} url - The audio URL
   */
  async fetchAndStream(url) {
    try {
      this.fetchController = new AbortController();
      const response = await fetch(url, { signal: this.fetchController.signal });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      let totalBytesReceived = 0;
      let hasStartedPlayback = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Signal end of stream
          if (this.sourceBuffer && !this.sourceBuffer.updating) {
            this.mediaSource.endOfStream();
          }
          break;
        }

        totalBytesReceived += value.byteLength;

        // Queue the chunk for appending
        this.bufferQueue.push(value);
        this.processBufferQueue();

        // Start playback once we have enough data
        if (!hasStartedPlayback && totalBytesReceived >= this.minBufferSize) {
          hasStartedPlayback = true;
          // Small delay to ensure buffer is processed
          setTimeout(() => this.play(), 100);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Streaming error:', error);
        throw error;
      }
    }
  }

  /**
   * Process queued buffer chunks
   */
  processBufferQueue() {
    if (this.isUpdating || this.bufferQueue.length === 0) {
      return;
    }

    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      // Try again later
      setTimeout(() => this.processBufferQueue(), 50);
      return;
    }

    try {
      this.isUpdating = true;
      const chunk = this.bufferQueue.shift();
      this.sourceBuffer.appendBuffer(chunk);
    } catch (error) {
      console.error('Error appending buffer:', error);
      this.isUpdating = false;
      // Try to recover
      if (error.name === 'QuotaExceededError') {
        // Buffer is full, wait before retrying
        setTimeout(() => this.processBufferQueue(), 1000);
      }
    }
  }

  /**
   * Set up source buffer event listeners
   */
  setupSourceBufferListeners() {
    this.sourceBuffer.addEventListener('updateend', () => {
      this.isUpdating = false;
      // Process next chunk if available
      if (this.bufferQueue.length > 0) {
        this.processBufferQueue();
      }
    });

    this.sourceBuffer.addEventListener('error', (error) => {
      console.error('SourceBuffer error:', error);
      this.isUpdating = false;
    });
  }

  /**
   * Set up audio element event listeners
   */
  setupAudioEventListeners() {
    this.audioElement.addEventListener('playing', () => {
      if (this.onPlayingCallback) {
        this.onPlayingCallback();
      }
    });

    this.audioElement.addEventListener('pause', () => {
      if (this.onPausedCallback) {
        this.onPausedCallback();
      }
    });

    this.audioElement.addEventListener('ended', () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audioElement.addEventListener('error', (error) => {
      console.error('Audio element error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    });
  }

  /**
   * Fallback loading for browsers without MediaSource support
   * @param {string} url - The audio URL
   */
  async loadFallback(url) {
    try {
      // Use traditional audio loading
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      this.fallbackAudio.src = blobUrl;
      this.audioElement = this.fallbackAudio;

      // Set up event listeners on fallback audio
      this.setupAudioEventListeners();

      // Clean up blob URL when done
      this.fallbackAudio.addEventListener(
        'ended',
        () => {
          URL.revokeObjectURL(blobUrl);
        },
        { once: true }
      );
    } catch (error) {
      console.error('Fallback loading failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  /**
   * Play the audio
   */
  async play() {
    const audio = this.audioElement || this.fallbackAudio;
    if (audio?.src) {
      try {
        await audio.play();
        this.isPaused = false;
      } catch (error) {
        console.error('Play failed:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
      }
    }
  }

  /**
   * Pause the audio
   */
  pause() {
    const audio = this.audioElement || this.fallbackAudio;
    if (audio) {
      audio.pause();
      this.isPaused = true;
    }
  }

  /**
   * Stop the audio and clean up
   */
  stop() {
    const audio = this.audioElement || this.fallbackAudio;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.cleanup();
  }

  /**
   * Replay from the beginning
   */
  replay() {
    const audio = this.audioElement || this.fallbackAudio;
    if (audio) {
      audio.currentTime = 0;
      return this.play();
    }
  }

  /**
   * Get current playback time
   */
  get currentTime() {
    const audio = this.audioElement || this.fallbackAudio;
    return audio ? audio.currentTime : 0;
  }

  /**
   * Set current playback time
   */
  set currentTime(time) {
    const audio = this.audioElement || this.fallbackAudio;
    if (audio) {
      audio.currentTime = time;
    }
  }

  /**
   * Get audio duration
   */
  get duration() {
    const audio = this.audioElement || this.fallbackAudio;
    return audio ? audio.duration : 0;
  }

  /**
   * Check if audio is playing
   */
  get isPlaying() {
    const audio = this.audioElement || this.fallbackAudio;
    return audio && !audio.paused && !audio.ended;
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  set volume(value) {
    const audio = this.audioElement || this.fallbackAudio;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * Get volume
   */
  get volume() {
    const audio = this.audioElement || this.fallbackAudio;
    return audio ? audio.volume : 1;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Abort any ongoing fetch
    if (this.fetchController) {
      this.fetchController.abort();
      this.fetchController = null;
    }

    // Clear buffer queue
    this.bufferQueue = [];
    this.isUpdating = false;
    this.isStreaming = false;

    // Clean up MediaSource
    if (this.sourceBuffer) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.mediaSource.removeSourceBuffer(this.sourceBuffer);
        }
      } catch (error) {
        console.warn('Error removing source buffer:', error);
      }
      this.sourceBuffer = null;
    }

    if (this.mediaSource) {
      if (this.mediaSource.readyState === 'open') {
        try {
          this.mediaSource.endOfStream();
        } catch (error) {
          console.warn('Error ending stream:', error);
        }
      }
      this.mediaSource = null;
    }

    // Clean up audio element
    if (this.audioElement?.src) {
      if (this.audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioElement.src);
      }
      this.audioElement.src = '';
      this.audioElement = null;
    }

    // Reset fallback audio
    if (this.fallbackAudio.src) {
      if (this.fallbackAudio.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.fallbackAudio.src);
      }
      this.fallbackAudio.src = '';
    }
  }

  /**
   * Set event callbacks
   */
  onPlaying(callback) {
    this.onPlayingCallback = callback;
  }

  onPaused(callback) {
    this.onPausedCallback = callback;
  }

  onEnded(callback) {
    this.onEndedCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }
}
