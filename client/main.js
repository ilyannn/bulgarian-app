/**
 * Bulgarian Voice Coach - Main Application
 */

import { l1LanguageService } from './services/L1LanguageService.js';
import LocalProgressService from './services/LocalProgressService.js';
import PerformanceMonitor from './services/PerformanceMonitor.js';
import { TranscriptDisplay } from './services/TranscriptDisplay.js';

class BulgarianVoiceCoach {
  constructor() {
    // Audio context and processing
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.isRecording = false;

    // WebSocket connection
    this.websocket = null;
    this.isConnected = false;

    // Enhanced transcript display
    this.transcriptDisplay = new TranscriptDisplay();
    this.lastConfidenceScore = 0.85; // Default confidence

    // UI elements
    this.micButton = document.getElementById('mic-button');
    this.micPanel = document.getElementById('mic-panel');
    this.micStatus = document.getElementById('mic-status');
    this.micLevelBar = document.getElementById('mic-level-bar');
    this.transcriptArea = document.getElementById('transcript-area');
    this.clearBtn = document.getElementById('clear-btn');
    this.playLastBtn = document.getElementById('play-last-btn');

    // Audio control buttons
    this.playPauseBtn = document.getElementById('play-pause-btn');
    this.replayBtn = document.getElementById('replay-btn');
    this.stopBtn = document.getElementById('stop-btn');

    // Status indicators
    this.connectionStatus = document.getElementById('connection-status');
    this.connectionText = document.getElementById('connection-text');
    this.audioStatus = document.getElementById('audio-status');
    this.audioText = document.getElementById('audio-text');
    this.latencyText = document.getElementById('latency-text');

    // Audio playback
    this.audioPlayer = new Audio();
    this.lastResponseText = '';
    this.currentAudioUrl = null;
    this.isPlaying = false;
    this.isPaused = false;

    // Error highlighting
    this.lastDetectedErrors = [];

    // Audio level visualization
    this.audioLevelHistory = [];
    this.audioLevelPeaks = [];
    this.lastLevelUpdate = 0;

    // Timing for latency measurement
    this.speechStartTime = null;
    this.responseStartTime = null;

    // Progress tracking service
    this.progressService = new LocalProgressService();

    // Performance monitoring
    this.performanceMonitor = new PerformanceMonitor();

    // Initialize enhanced transcript display
    this.transcriptDisplay.init(this.transcriptArea);

    // Initialize
    this.initializeEventListeners();
    this.initializeWebSocket();
    this.initializeL1Language();
    this.loadWarmupDrills();
  }

  initializeEventListeners() {
    // Microphone button
    this.micButton.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    // Clear transcript
    this.clearBtn.addEventListener('click', () => {
      this.clearTranscript();
    });

    // Play last response
    this.playLastBtn.addEventListener('click', () => {
      this.playLastResponse();
    });

    // Audio control buttons
    this.playPauseBtn.addEventListener('click', () => {
      this.togglePlayPause();
    });

    this.replayBtn.addEventListener('click', () => {
      this.replayAudio();
    });

    this.stopBtn.addEventListener('click', () => {
      this.stopAudio();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && event.ctrlKey) {
        event.preventDefault();
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      }
    });

    // Event delegation for dynamically created drill practice buttons
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('start-drill-practice')) {
        event.preventDefault();
        if (window.currentDrills && window.interactiveDrills) {
          const drillEvent = new CustomEvent('startDrillPractice', {
            detail: {
              drills: window.currentDrills,
              mode: 'practice',
            },
          });
          document.dispatchEvent(drillEvent);
        }
      }
    });

    // Listen for drill completion events to track progress
    window.addEventListener('drill-completed', (event) => {
      this.progressService.updateDrillResult({
        grammarId: event.detail.drill.grammarId,
        drillType: event.detail.drill.type,
        userAnswer: event.detail.drill.userAnswer,
        correctAnswer: event.detail.drill.correctAnswer,
        isCorrect: event.detail.correct,
        responseTimeMs: event.detail.timeSpent,
        hintUsed: event.detail.hintUsed || false,
      });
    });
  }

  async initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/asr`;

    // Connection retry logic with exponential backoff
    if (!this.connectionAttempts) this.connectionAttempts = 0;
    if (!this.maxRetries) this.maxRetries = 5;

    try {
      this.websocket = new WebSocket(wsUrl);

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.websocket.readyState === WebSocket.CONNECTING) {
          this.websocket.close();
          this.handleConnectionFailure();
        }
      }, 5000);

      this.websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.connectionAttempts = 0; // Reset retry counter on successful connection
        this.updateConnectionStatus('connected', 'Connected');
        this.showSuccess('Connected to voice processing server');
        console.log('WebSocket connected');
      };

      this.websocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');

        // Stop recording if connection is lost
        if (this.isRecording) {
          this.stopRecording();
          this.showInfo('Recording stopped due to connection loss');
        }

        console.log('WebSocket disconnected:', event.code, event.reason);

        // Attempt to reconnect with exponential backoff
        if (!event.wasClean && this.connectionAttempts < this.maxRetries) {
          const delay = Math.min(1000 * 2 ** this.connectionAttempts, 30000);
          this.connectionAttempts++;

          this.updateConnectionStatus(
            'processing',
            `Reconnecting in ${delay / 1000}s... (${this.connectionAttempts}/${this.maxRetries})`
          );

          setTimeout(() => {
            if (!this.isConnected) {
              this.initializeWebSocket();
            }
          }, delay);
        } else if (this.connectionAttempts >= this.maxRetries) {
          this.updateConnectionStatus('error', 'Connection Failed - Refresh to retry');
          this.showError('Unable to connect to server. Please refresh the page to try again.');
        }
      };

      this.websocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('error', 'Connection Error');
        this.handleConnectionFailure();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.showError('Received invalid data from server');
        }
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.updateConnectionStatus('error', 'Connection Failed');
      this.handleConnectionFailure();
    }
  }

  async initializeL1Language() {
    try {
      // Initialize the L1 language service
      await l1LanguageService.initialize();

      // Create the language selector UI
      const languageSelector = l1LanguageService.createLanguageSelector();

      // Find or create a settings panel to add the selector
      let settingsPanel = document.getElementById('settings-panel');
      if (!settingsPanel) {
        // Create a settings panel if it doesn't exist
        settingsPanel = document.createElement('div');
        settingsPanel.id = 'settings-panel';
        settingsPanel.className = 'settings-panel';

        // Insert after the mic panel
        const micPanel = document.getElementById('mic-panel');
        if (micPanel) {
          micPanel.parentNode.insertBefore(settingsPanel, micPanel.nextSibling);
        } else {
          // Fallback to adding at the beginning of the body
          document.body.insertBefore(settingsPanel, document.body.firstChild);
        }
      }

      // Add the language selector to the settings panel
      settingsPanel.appendChild(languageSelector);

      // Listen for language changes to update contrast notes
      window.addEventListener('l1-language-changed', (event) => {
        console.log('L1 language changed to:', event.detail.language);
        // Reload any active grammar content with new contrast notes
        this.reloadContrastNotes();
      });
    } catch (error) {
      console.error('Failed to initialize L1 language service:', error);
    }
  }

  reloadContrastNotes() {
    // If there are any active grammar chips or drills, reload them with new L1 contrast
    const grammarChips = document.querySelectorAll('.grammar-chip');
    grammarChips.forEach((chip) => {
      const grammarId = chip.dataset.grammarId;
      if (grammarId) {
        // Re-fetch and update the contrast note for this grammar item
        this.updateGrammarChipContrast(chip, grammarId);
      }
    });
  }

  async updateGrammarChipContrast(chip, grammarId) {
    try {
      const response = await fetch(`/content/grammar/${grammarId}`);
      if (response.ok) {
        const grammarItem = await response.json();
        const contrastNote = l1LanguageService.filterContrastNotes(grammarItem);

        // Update the chip's tooltip or expand content with new contrast
        const contrastElement = chip.querySelector('.contrast-note');
        if (contrastElement && contrastNote) {
          contrastElement.textContent = contrastNote;
          contrastElement.className = `contrast-note ${l1LanguageService.getTypographyClass()}`;
        }
      }
    } catch (error) {
      console.error('Failed to update grammar chip contrast:', error);
    }
  }

  handleConnectionFailure() {
    if (this.connectionAttempts < this.maxRetries) {
      const delay = Math.min(1000 * 2 ** this.connectionAttempts, 30000);
      this.connectionAttempts++;

      setTimeout(() => {
        if (!this.isConnected) {
          this.initializeWebSocket();
        }
      }, delay);
    } else {
      this.showError('Maximum reconnection attempts reached. Please refresh the page.');
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'partial':
        // Extract confidence score if available
        if (message.confidence !== undefined) {
          this.lastConfidenceScore = message.confidence;
        }
        this.updatePartialTranscript(message.text);
        // Mark ASR start on first partial
        if (!this.hasReceivedPartial) {
          this.performanceMonitor.mark('asrStart');
          this.hasReceivedPartial = true;
        }
        break;
      case 'final':
        // Extract confidence score if available
        if (message.confidence !== undefined) {
          this.lastConfidenceScore = message.confidence;
        }
        this.addFinalTranscript(message.text);
        this.measureLatency('transcription');
        // Mark ASR end
        this.performanceMonitor.mark('asrEnd', {
          transcriptLength: message.text?.length || 0,
          confidence: this.lastConfidenceScore,
        });
        // Mark LLM start (processing begins)
        this.performanceMonitor.mark('llmStart');
        this.hasReceivedPartial = false;
        break;
      case 'coach':
        this.addCoachResponse(message.payload);
        this.measureLatency('response');
        // Mark LLM end and TTS start
        this.performanceMonitor.mark('llmEnd', {
          responseLength: message.payload?.text?.length || 0,
        });
        if (message.payload?.audio) {
          this.performanceMonitor.mark('ttsStart');
        }
        break;
      case 'audio_ready':
        // Mark TTS end when audio is ready
        this.performanceMonitor.mark('ttsEnd');
        this.performanceMonitor.mark('end');
        this.updateLatencyDisplay();
        break;
      case 'performance':
        // Server-side performance metrics
        if (message.metrics) {
          this.handleServerMetrics(message.metrics);
        }
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  async startRecording() {
    if (!this.isConnected) {
      this.showError('Not connected to server');
      return;
    }

    try {
      // Initialize audio context if needed
      if (!this.audioContext) {
        await this.initializeAudio();
      }

      // Resume audio context (required by browser policies)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Start recording
      this.isRecording = true;
      this.speechStartTime = Date.now();
      this.hasReceivedPartial = false;
      this.vadStartMarked = false;

      // Start performance session
      const sessionId = this.performanceMonitor.startSession();
      this.currentSessionId = sessionId;

      this.workletNode.port.postMessage({ type: 'start' });

      // Update UI
      this.updateRecordingUI(true);
      this.micStatus.textContent = 'Listening...';
      this.updateAudioStatus('recording', 'Recording');

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showError(`Failed to start recording: ${error.message}`);
      this.updateAudioStatus('error', 'Audio Error');
    }
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.workletNode?.port.postMessage({ type: 'stop' });

    // Mark VAD end (speech detection complete)
    this.performanceMonitor.mark('vadEnd');

    // Update UI
    this.updateRecordingUI(false);
    this.micStatus.textContent = 'Click microphone to start';
    this.updateAudioStatus('ready', 'Audio: Ready');

    console.log('Recording stopped');
  }

  async initializeAudio() {
    try {
      // Request microphone access with enhanced constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000, min: 16000 },
          channelCount: 1,
          latency: { ideal: 0.01, max: 0.1 }, // Low latency for real-time processing
        },
      });

      // Create audio context with optimal settings
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive', // Optimize for real-time interaction
      });

      // Load audio worklet with error handling
      try {
        await this.audioContext.audioWorklet.addModule('./audio-worklet.js');

        // Create audio nodes
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.workletNode = new AudioWorkletNode(this.audioContext, 'voice-processor', {
          processorOptions: {
            targetSampleRate: 16000,
            frameSize: 320,
            maxBufferSize: 4096,
          },
        });

        // Connect audio graph
        this.sourceNode.connect(this.workletNode);

        // Handle worklet messages with throttling to prevent flooding
        this.workletNode.port.onmessage = (event) => {
          this.handleWorkletMessage(event.data);
        };

        this.updateAudioStatus('ready', 'Audio: Ready');
        this.showSuccess('Audio system initialized successfully');
        console.log('Audio initialized successfully');
      } catch (workletError) {
        console.warn('AudioWorklet failed, falling back to ScriptProcessor:', workletError);
        await this.initializeAudioFallback();
      }
    } catch (error) {
      console.error('Audio initialization failed:', error);
      this.updateAudioStatus('error', 'Audio: Failed');

      if (error.name === 'NotAllowedError') {
        this.showError(
          'Microphone access denied. Please allow microphone permissions and refresh the page.'
        );
      } else if (error.name === 'NotFoundError') {
        this.showError('No microphone found. Please connect a microphone and try again.');
      } else {
        this.showError(`Audio initialization failed: ${error.message}`);
      }

      // Still try fallback
      try {
        await this.initializeAudioFallback();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        this.showError('Audio system unavailable. Voice features will not work.');
      }
    }
  }

  async initializeAudioFallback() {
    console.log('Falling back to ScriptProcessor');

    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
        });
      }

      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      const processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      processorNode.onaudioprocess = (event) => {
        if (this.isRecording) {
          const inputData = event.inputBuffer.getChannelData(0);
          this.processAudioData(inputData);
        }
      };

      this.sourceNode.connect(processorNode);
      processorNode.connect(this.audioContext.destination);

      this.updateAudioStatus('ready', 'Audio: Ready (Fallback)');
      console.log('ScriptProcessor fallback initialized');
    } catch (error) {
      console.error('Audio fallback failed:', error);
      this.updateAudioStatus('error', 'Audio: Not Available');
      throw error;
    }
  }

  handleWorkletMessage(message) {
    switch (message.type) {
      case 'audioFrame':
        if (this.isRecording && this.isConnected) {
          // Track WebSocket latency for critical messages
          if (this.shouldTrackMessage()) {
            const messageId = this.generateMessageId();
            this.performanceMonitor.startWebSocketTiming(messageId);
            // Note: We'd need server support to echo back the messageId
          }
          this.websocket.send(message.data);
          // Mark speech detected on first audio frame with significant level
          if (!this.vadStartMarked && message.level > 0.01) {
            this.markSpeechDetected();
          }
        }
        break;
      case 'level':
        this.updateAudioLevel(message.value);
        // Detect speech start based on audio level
        if (this.isRecording && !this.vadStartMarked && message.value > 0.02) {
          this.markSpeechDetected();
        }
        break;
      case 'speechStart':
        // Explicit speech start detection from worklet
        this.markSpeechDetected();
        break;
    }
  }

  processAudioData(audioData) {
    // Fallback audio processing for ScriptProcessor
    // This is simplified - ideally you'd implement resampling and framing

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    // Send to WebSocket
    if (this.isConnected) {
      this.websocket.send(pcmData.buffer);
    }

    // Update audio level
    let level = 0;
    for (let i = 0; i < audioData.length; i++) {
      level += Math.abs(audioData[i]);
    }
    level = level / audioData.length;
    this.updateAudioLevel(Math.min(1.0, level * 10));
  }

  updateAudioLevel(level) {
    const now = Date.now();

    // Smooth the level using a moving average
    this.audioLevelHistory.push(level);
    if (this.audioLevelHistory.length > 5) {
      this.audioLevelHistory.shift();
    }

    const smoothedLevel =
      this.audioLevelHistory.reduce((a, b) => a + b, 0) / this.audioLevelHistory.length;

    // Update level bar with animation
    const percentage = Math.min(100, smoothedLevel * 100);
    this.micLevelBar.style.width = `${percentage}%`;

    // Update level bar color based on intensity
    if (percentage < 20) {
      this.micLevelBar.style.background = 'linear-gradient(90deg, #4ade80, #4ade80)';
    } else if (percentage < 60) {
      this.micLevelBar.style.background = 'linear-gradient(90deg, #4ade80, #fbbf24)';
    } else if (percentage < 85) {
      this.micLevelBar.style.background = 'linear-gradient(90deg, #4ade80, #fbbf24, #f87171)';
    } else {
      this.micLevelBar.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
    }

    // Add peak detection for visual feedback
    if (level > 0.7 && now - this.lastLevelUpdate > 100) {
      this.addLevelPeak(percentage);
      this.lastLevelUpdate = now;
    }

    // Update mic status with level feedback
    if (this.isRecording) {
      if (percentage < 5) {
        this.micStatus.textContent = 'Listening... (speak louder)';
      } else if (percentage > 85) {
        this.micStatus.textContent = 'Listening... (very loud!)';
      } else if (percentage > 40) {
        this.micStatus.textContent = 'Listening... (good level)';
      } else {
        this.micStatus.textContent = 'Listening...';
      }
    }
  }

  addLevelPeak(percentage) {
    // Create a visual peak indicator
    const levelContainer = this.micLevelBar.parentElement;
    const peak = document.createElement('div');
    peak.className = 'level-peak';
    peak.style.cssText = `
      position: absolute;
      left: ${percentage}%;
      top: 0;
      width: 2px;
      height: 100%;
      background: rgba(255, 255, 255, 0.8);
      animation: fadeOutPeak 1s ease-out forwards;
      pointer-events: none;
    `;

    // Add CSS animation if not already present
    if (!document.querySelector('#peak-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'peak-animation-styles';
      style.textContent = `
        @keyframes fadeOutPeak {
          0% { opacity: 1; transform: scaleY(1.2); }
          100% { opacity: 0; transform: scaleY(0.8); }
        }
      `;
      document.head.appendChild(style);
    }

    levelContainer.appendChild(peak);

    // Clean up peak after animation
    setTimeout(() => {
      if (peak.parentNode) {
        peak.parentNode.removeChild(peak);
      }
    }, 1000);
  }

  updateRecordingUI(recording) {
    if (recording) {
      this.micButton.textContent = '⏸️';
      this.micButton.classList.add('recording');
      this.micPanel.classList.add('recording');
    } else {
      this.micButton.textContent = '🎤';
      this.micButton.classList.remove('recording');
      this.micPanel.classList.remove('recording');
      this.micLevelBar.style.width = '0%';
    }
  }

  updatePartialTranscript(text) {
    // Use enhanced transcript display with confidence indicator
    const confidence = this.lastConfidenceScore || 0.7;
    this.transcriptDisplay.updatePartialTranscript(text, confidence);
  }

  addFinalTranscript(text) {
    // Use enhanced transcript display with bubbles and confidence
    const confidence = this.lastConfidenceScore || 0.85;
    this.transcriptDisplay.addFinalTranscript(text, confidence, this.lastDetectedErrors);
  }

  addCoachResponse(payload) {
    // Store corrections for error highlighting
    this.lastDetectedErrors = payload.corrections || [];

    // Use enhanced transcript display for coach responses
    this.transcriptDisplay.addCoachResponse(payload);

    // Store drills for interactive practice if any
    if (payload.drills && payload.drills.length > 0) {
      window.currentDrills = payload.drills;
    }

    // Store for playback
    this.lastResponseText = payload.reply_bg;
    this.playLastBtn.disabled = false;
  }

  async playLastResponse() {
    if (!this.lastResponseText) return;

    try {
      this.playLastBtn.disabled = true;
      this.playLastBtn.textContent = '🔄 Loading...';

      const response = await window.fetch(`/tts?text=${encodeURIComponent(this.lastResponseText)}`);
      if (!response.ok) throw new Error('TTS request failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      this.audioPlayer.src = audioUrl;
      await this.audioPlayer.play();

      this.audioPlayer.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.playLastBtn.disabled = false;
        this.playLastBtn.textContent = '🔊 Play Last Response';
      };
    } catch (error) {
      console.error('TTS playback failed:', error);
      this.showError(`Could not play audio: ${error.message}`);
      this.playLastBtn.disabled = false;
      this.playLastBtn.textContent = '🔊 Play Last Response';
    }
  }

  clearTranscript() {
    // Use enhanced transcript display clear method
    this.transcriptDisplay.clearTranscripts();
    this.lastDetectedErrors = [];
    this.lastResponseText = '';
    this.enableAudioControls(false);

    // Clean up any current audio
    this.stopAudio();
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  scrollToBottom() {
    // Use enhanced transcript display scroll method
    this.transcriptDisplay.scrollToBottom();
  }

  updateConnectionStatus(status, text) {
    this.connectionStatus.className = 'status-dot';
    if (status === 'connected') {
      this.connectionStatus.classList.add('connected');
    } else if (status === 'processing') {
      this.connectionStatus.classList.add('processing');
    }
    this.connectionText.textContent = text;
  }

  updateAudioStatus(status, text) {
    this.audioStatus.className = 'status-dot';
    if (status === 'ready' || status === 'recording') {
      this.audioStatus.classList.add('connected');
    } else if (status === 'processing') {
      this.audioStatus.classList.add('processing');
    }
    this.audioText.textContent = text;
  }

  measureLatency(type) {
    if (!this.speechStartTime) return;

    const now = Date.now();
    const latency = now - this.speechStartTime;
    this.latencyText.textContent = `Latency: ${latency}ms`;

    if (type === 'response') {
      this.speechStartTime = null; // Reset for next measurement
    }
  }

  /**
   * Update latency display with performance monitor data
   */
  updateLatencyDisplay() {
    const stats = this.performanceMonitor.getStatistics();
    const breakdown = this.performanceMonitor.getSessionBreakdown();

    if (!breakdown || !stats.e2e.count) {
      this.latencyText.textContent = 'Latency: --';
      return;
    }

    // Get performance level for color coding
    const level = this.performanceMonitor.getPerformanceLevel(breakdown.total);

    // Update main latency display
    this.latencyText.textContent = `${level.icon} ${breakdown.total}ms`;
    this.latencyText.style.color = level.color;

    // Add detailed breakdown on hover (via title attribute)
    if (breakdown.stages) {
      const details = [];
      if (breakdown.stages.vad) details.push(`VAD: ${breakdown.stages.vad.duration}ms`);
      if (breakdown.stages.asr) details.push(`ASR: ${breakdown.stages.asr.duration}ms`);
      if (breakdown.stages.llm) details.push(`LLM: ${breakdown.stages.llm.duration}ms`);
      if (breakdown.stages.tts) details.push(`TTS: ${breakdown.stages.tts.duration}ms`);

      this.latencyText.title = details.join(' | ');
    }

    // Log performance warnings
    if (level.level === 'warning' || level.level === 'critical') {
      console.warn('Performance degradation detected:', breakdown);
    }
  }

  /**
   * Handle server-side performance metrics
   */
  handleServerMetrics(metrics) {
    // Add server metrics to our monitor
    if (metrics.asr_time) {
      this.performanceMonitor.addMetric('asr', metrics.asr_time * 1000);
    }
    if (metrics.llm_time) {
      this.performanceMonitor.addMetric('llm', metrics.llm_time * 1000);
    }
    if (metrics.tts_time) {
      this.performanceMonitor.addMetric('tts', metrics.tts_time * 1000);
    }
  }

  /**
   * Mark VAD start when speech is detected
   */
  markSpeechDetected() {
    if (this.currentSessionId && !this.vadStartMarked) {
      this.performanceMonitor.mark('vadStart');
      this.vadStartMarked = true;
    }
  }

  /**
   * Determine if we should track this message for latency
   * Track only a sample to avoid overhead
   */
  shouldTrackMessage() {
    // Track 1 in 50 messages to avoid overhead
    return Math.random() < 0.02;
  }

  /**
   * Generate unique message ID for tracking
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  showError(message, duration = 5000) {
    // Create a proper toast notification instead of alert()
    const toast = document.createElement('div');
    toast.className = 'toast-notification error';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">⚠️</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add to document
    document.body.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, duration);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
  }

  showSuccess(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification success';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">✅</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, duration);

    setTimeout(() => toast.classList.add('show'), 10);
  }

  showInfo(message, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification info';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">ℹ️</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, duration);

    setTimeout(() => toast.classList.add('show'), 10);
  }

  // Resource cleanup methods
  cleanup() {
    console.log('Cleaning up resources...');

    // Stop recording
    this.stopRecording();

    // Clean up audio resources
    this.cleanupAudio();

    // Close WebSocket connection
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close(1000, 'Application cleanup');
    }

    // Clean up any remaining blob URLs
    this.cleanupBlobUrls();

    console.log('Cleanup complete');
  }

  cleanupAudio() {
    try {
      // Stop all media tracks
      if (this.mediaStream) {
        for (const track of this.mediaStream.getTracks()) {
          track.stop();
          console.log('Stopped media track:', track.kind);
        }
        this.mediaStream = null;
      }

      // Disconnect and cleanup audio nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode.port.onmessage = null;
        this.workletNode = null;
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext
          .close()
          .then(() => {
            console.log('AudioContext closed');
          })
          .catch((error) => {
            console.warn('Error closing AudioContext:', error);
          });
        this.audioContext = null;
      }
    } catch (error) {
      console.warn('Error during audio cleanup:', error);
    }
  }

  cleanupBlobUrls() {
    // Clean up any blob URLs that might be lingering
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    if (this.audioPlayer?.src?.startsWith('blob:')) {
      URL.revokeObjectURL(this.audioPlayer.src);
      this.audioPlayer.src = '';
    }
  }

  // Enhanced offline/online detection
  handleOnlineStatus() {
    if (navigator.onLine) {
      this.showSuccess('Connection restored');
      if (!this.isConnected) {
        this.initializeWebSocket();
      }
    } else {
      this.showError('You appear to be offline. Voice features may not work properly.');
      this.isConnected = false;
      this.updateConnectionStatus('error', 'Offline');
      if (this.isRecording) {
        this.stopRecording();
      }
    }
  }

  // Enhanced visibility change handling
  handleVisibilityChange() {
    if (document.hidden) {
      // Page is now hidden - pause recording to save resources
      if (this.isRecording) {
        this.wasRecordingBeforeHidden = true;
        this.stopRecording();
        console.log('Paused recording due to page being hidden');
      }
    } else {
      // Page is now visible
      if (this.wasRecordingBeforeHidden) {
        this.wasRecordingBeforeHidden = false;
        // Optionally restart recording
        this.showInfo('Page visible again. Click microphone to resume recording.');
      }
    }
  }

  async loadWarmupDrills() {
    try {
      // Get due items from local progress service
      const dueItems = this.progressService.getWarmupItems(3);

      if (dueItems.length > 0) {
        this.displayWarmupDrills(dueItems);
      } else {
        this.displayWelcomeMessage();
      }
    } catch (error) {
      console.warn('Failed to load warm-up drills:', error);
      this.displayWelcomeMessage();
    }
  }

  getUserId() {
    // Get user ID from progress service
    return this.progressService.getUserId();
  }

  displayWarmupDrills(dueItems) {
    const warmupHtml = `
      <div class="warmup-section" style="text-align: center; padding: 2rem; background: rgba(102, 126, 234, 0.1); border-radius: 12px; margin-bottom: 1rem;">
        <h3 style="color: #667eea; margin-bottom: 1rem;">🏃‍♀️ Warm-up Practice</h3>
        <p style="color: #666; margin-bottom: 1.5rem;">You have ${dueItems.length} grammar ${dueItems.length === 1 ? 'item' : 'items'} due for review!</p>
        <div class="warmup-items">
          ${dueItems
            .map(
              (item) => `
            <div class="warmup-item" style="background: white; margin: 0.5rem 0; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea;">
              <strong>Grammar:</strong> <code>${item.grammarId}</code>
              ${item.title ? `<div style="color: #666; font-size: 0.9rem; margin-top: 0.3rem;">${item.title}</div>` : ''}
              <div style="font-size: 0.8rem; color: #888; margin-top: 0.3rem;">Level ${item.masteryLevel}/6</div>
              <button class="btn btn-primary warmup-practice-btn" data-grammar="${item.grammarId}" style="margin-left: 1rem; padding: 0.3rem 0.8rem; font-size: 0.9rem;">
                ⚡ Practice Now
              </button>
            </div>
          `
            )
            .join('')}
        </div>
        <p style="color: #888; font-size: 0.9rem; margin-top: 1rem;">💡 Start speaking to practice, or click "Practice Now" for specific drills</p>
      </div>
      <div style="text-align: center; color: #999; padding: 1rem;">
        Ready for your Bulgarian practice session...
      </div>
    `;

    this.transcriptArea.innerHTML = warmupHtml;

    // Add event listeners for practice buttons
    const practiceButtons = this.transcriptArea.querySelectorAll('.warmup-practice-btn');
    for (const button of practiceButtons) {
      button.addEventListener('click', (e) => {
        const grammarId = e.target.getAttribute('data-grammar');
        this.startGrammarPractice(grammarId);
      });
    }
  }

  displayWelcomeMessage() {
    this.transcriptArea.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="background: rgba(76, 175, 80, 0.1); border-radius: 12px; padding: 2rem; margin-bottom: 1rem;">
          <h3 style="color: #4caf50; margin-bottom: 1rem;">🎉 Welcome to Bulgarian Voice Coach!</h3>
          <p style="color: #666; margin-bottom: 1rem;">You're all caught up with your reviews. Great job!</p>
          <p style="color: #888; font-size: 0.9rem;">Start speaking to begin practicing Bulgarian...</p>
        </div>
      </div>
    `;
  }

  async startGrammarPractice(grammarId) {
    try {
      // Fetch specific drills for this grammar item
      const response = await window.fetch(`/content/drills/${encodeURIComponent(grammarId)}`);
      if (!response.ok) {
        this.showError('Could not load practice drills');
        return;
      }

      const drills = await response.json();

      if (drills.length > 0) {
        // Take the first drill for quick practice
        const drill = drills[0];

        this.transcriptArea.innerHTML = `
          <div class="practice-drill" style="background: rgba(255, 193, 7, 0.1); border-radius: 12px; padding: 2rem; text-align: center;">
            <h3 style="color: #ffc107; margin-bottom: 1rem;">⚡ Quick Practice: ${grammarId}</h3>
            <div style="background: white; padding: 1.5rem; border-radius: 8px; margin: 1rem 0;">
              <p style="font-weight: 500; margin-bottom: 1rem; color: #333;">${drill.prompt}</p>
              <div style="color: #28a745; font-weight: 600; font-size: 1.1rem;">
                Answer: "${drill.expected_answer}"
              </div>
            </div>
            <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
              💬 Try saying this out loud, then start your conversation!
            </p>
            <button class="btn btn-secondary" onclick="document.getElementById('transcript-area').innerHTML='<div style='text-align: center; color: #999; padding: 2rem;'>Start speaking to practice Bulgarian...</div>'">✖ Close Practice</button>
          </div>
        `;
      } else {
        this.showToast('No practice drills available for this grammar item', 'info');
      }
    } catch (error) {
      console.error('Failed to start grammar practice:', error);
      this.showError('Could not start practice session');
    }
  }

  highlightErrors(text, corrections) {
    if (!corrections || corrections.length === 0) {
      return text;
    }

    let highlightedText = text;

    // Sort corrections by position (if available) to avoid overlap issues
    const sortedCorrections = [...corrections].sort((a, b) => {
      const aPos = a.position ? a.position.start : 0;
      const bPos = b.position ? b.position.start : 0;
      return bPos - aPos; // Reverse order to avoid index shifting
    });

    sortedCorrections.forEach((correction, index) => {
      const beforeText = correction.before;
      const afterText = correction.after;
      const errorType = correction.type || 'grammar';

      if (beforeText && highlightedText.includes(beforeText)) {
        // Create a highlighted version with tooltip
        const highlightHtml = `<span class="error-highlight error-${this.getErrorClass(errorType)}" 
          title="${errorType}: ${beforeText} → ${afterText}" 
          data-correction-index="${index}"
          onclick="this.classList.toggle('error-expanded')">
          ${beforeText}
          <span class="error-tooltip">
            <strong>${errorType}:</strong><br>
            ${beforeText} → <span class="error-correction">${afterText}</span>
          </span>
        </span>`;

        // Replace the error text with highlighted version
        highlightedText = highlightedText.replace(beforeText, highlightHtml);
      }
    });

    return highlightedText;
  }

  getErrorClass(errorType) {
    // Map error types to CSS classes for different colors
    const typeMap = {
      grammar: 'grammar',
      agreement: 'agreement',
      article: 'article',
      case: 'case',
      tense: 'tense',
      spelling: 'spelling',
      vocab: 'vocab',
    };
    return typeMap[errorType] || 'general';
  }

  // Audio control methods
  enableAudioControls(enabled) {
    if (this.playPauseBtn) {
      this.playPauseBtn.disabled = !enabled;
    }
    if (this.replayBtn) {
      this.replayBtn.disabled = !enabled;
    }
    if (this.stopBtn) {
      this.stopBtn.disabled = !enabled;
    }
    if (!enabled && this.playPauseBtn) {
      this.playPauseBtn.textContent = '▶️ Play Response';
    }
  }

  async loadAudio() {
    if (!this.lastResponseText) {
      return false;
    }

    try {
      const response = await window.fetch(`/tts?text=${encodeURIComponent(this.lastResponseText)}`);
      if (!response.ok) {
        this.showError('Could not load audio: TTS request failed');
        return false;
      }

      const audioBlob = await response.blob();
      if (this.currentAudioUrl) {
        window.URL.revokeObjectURL(this.currentAudioUrl);
      }
      this.currentAudioUrl = window.URL.createObjectURL(audioBlob);

      if (this.audioPlayer) {
        this.audioPlayer.src = this.currentAudioUrl;
      }

      return true;
    } catch (error) {
      this.showError(`Could not load audio: ${error.message}`);
      return false;
    }
  }

  async togglePlayPause() {
    if (!this.isPlaying && !this.isPaused) {
      // Start playing
      try {
        const loaded = await this.loadAudio();
        if (loaded && this.audioPlayer) {
          await this.audioPlayer.play();
          this.onAudioPlaying();
        }
      } catch (error) {
        this.showError(`Playback failed: ${error.message}`);
      }
    } else if (this.isPlaying && !this.isPaused) {
      // Pause
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.onAudioPaused();
      }
    } else if (this.isPaused) {
      // Resume
      try {
        if (this.audioPlayer) {
          await this.audioPlayer.play();
          this.onAudioPlaying();
        }
      } catch (error) {
        this.showError(`Playback failed: ${error.message}`);
      }
    }
  }

  async replayAudio() {
    try {
      if (!this.currentAudioUrl) {
        await this.loadAudio();
      }

      if (this.audioPlayer) {
        this.audioPlayer.currentTime = 0;
        await this.audioPlayer.play();
        this.onAudioPlaying();
      }
    } catch (error) {
      this.showError(`Replay failed: ${error.message}`);
    }
  }

  stopAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    }
    this.isPlaying = false;
    this.isPaused = false;
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = '▶️ Play Response';
    }
  }

  onAudioPlaying() {
    this.isPlaying = true;
    this.isPaused = false;
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = '⏸️ Pause';
    }
  }

  onAudioPaused() {
    this.isPaused = true;
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = '▶️ Resume';
    }
  }

  onAudioEnded() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = '▶️ Play Response';
    }
    if (this.currentAudioUrl) {
      window.URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  onAudioError(_error) {
    this.showError('Audio playback error occurred');
    this.isPlaying = false;
    this.isPaused = false;
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = '▶️ Play Response';
    }
  }
}

// Global function for correction toggling
window.toggleCorrection = (index) => {
  const details = document.getElementById(`correction-${index}`);
  if (details) {
    details.classList.toggle('visible');
  }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.voiceCoach = new BulgarianVoiceCoach();
});

// Enhanced event listeners for cleanup and offline detection
window.addEventListener('beforeunload', () => {
  if (window.voiceCoach) {
    window.voiceCoach.cleanup();
  }
});

window.addEventListener('unload', () => {
  if (window.voiceCoach) {
    window.voiceCoach.cleanup();
  }
});

// Handle online/offline status
window.addEventListener('online', () => {
  if (window.voiceCoach) {
    window.voiceCoach.handleOnlineStatus();
  }
});

window.addEventListener('offline', () => {
  if (window.voiceCoach) {
    window.voiceCoach.handleOnlineStatus();
  }
});

// Enhanced page visibility changes
document.addEventListener('visibilitychange', () => {
  if (window.voiceCoach) {
    window.voiceCoach.handleVisibilityChange();
  }
});

// Handle browser tab focus/blur for additional resource management
window.addEventListener('focus', () => {
  if (window.voiceCoach && !navigator.onLine) {
    window.voiceCoach.handleOnlineStatus();
  }
});

window.addEventListener('blur', () => {
  // Save resources when window loses focus
  if (window.voiceCoach?.isRecording) {
    console.log('Window blurred while recording - consider pausing');
  }
});

// Export for testing
if (typeof window !== 'undefined') {
  window.BulgarianVoiceCoach = BulgarianVoiceCoach;
}

// ES6 export for modules
export default BulgarianVoiceCoach;
