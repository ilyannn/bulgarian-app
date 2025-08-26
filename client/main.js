/**
 * Bulgarian Voice Coach - Main Application
 */

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

    // UI elements
    this.micButton = document.getElementById('mic-button');
    this.micPanel = document.getElementById('mic-panel');
    this.micStatus = document.getElementById('mic-status');
    this.micLevelBar = document.getElementById('mic-level-bar');
    this.transcriptArea = document.getElementById('transcript-area');
    this.clearBtn = document.getElementById('clear-btn');
    this.playLastBtn = document.getElementById('play-last-btn');

    // Status indicators
    this.connectionStatus = document.getElementById('connection-status');
    this.connectionText = document.getElementById('connection-text');
    this.audioStatus = document.getElementById('audio-status');
    this.audioText = document.getElementById('audio-text');
    this.latencyText = document.getElementById('latency-text');

    // Audio playback
    this.audioPlayer = new Audio();
    this.lastResponseText = '';

    // Timing for latency measurement
    this.speechStartTime = null;
    this.responseStartTime = null;

    // Initialize
    this.initializeEventListeners();
    this.initializeWebSocket();
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
        this.updatePartialTranscript(message.text);
        break;
      case 'final':
        this.addFinalTranscript(message.text);
        this.measureLatency('transcription');
        break;
      case 'coach':
        this.addCoachResponse(message.payload);
        this.measureLatency('response');
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
          this.websocket.send(message.data);
        }
        break;
      case 'level':
        this.updateAudioLevel(message.value);
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
    this.micLevelBar.style.width = `${level * 100}%`;
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
    let partialLine = document.querySelector('.transcript-line.partial');

    if (!partialLine) {
      partialLine = document.createElement('div');
      partialLine.className = 'transcript-line partial';
      this.transcriptArea.appendChild(partialLine);
    }

    partialLine.innerHTML = `<strong>You (partial):</strong> <span class="bg-text">${text}</span>`;
    this.scrollToBottom();
  }

  addFinalTranscript(text) {
    // Remove partial line
    const partialLine = document.querySelector('.transcript-line.partial');
    if (partialLine) {
      partialLine.remove();
    }

    // Add final transcript
    const finalLine = document.createElement('div');
    finalLine.className = 'transcript-line final';
    finalLine.innerHTML = `<strong>You:</strong> <span class="bg-text">${text}</span>`;
    this.transcriptArea.appendChild(finalLine);
    this.scrollToBottom();
  }

  addCoachResponse(payload) {
    const coachLine = document.createElement('div');
    coachLine.className = 'transcript-line coach';

    let html = `<strong>Coach:</strong> <span class="bg-text bg-response">${payload.reply_bg}</span>`;

    // Add grammar chips UI if available
    if (payload.corrections && payload.corrections.length > 0) {
      if (window.grammarChipsUI) {
        // Create container for grammar chips
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'grammar-chips-wrapper';
        coachLine.innerHTML = html;
        this.transcriptArea.appendChild(coachLine);

        // Add chips to the coach response
        window.grammarChipsUI.createChips(payload.corrections, coachLine);

        // Don't add HTML for corrections since chips handle it
        html = null;
      } else if (window.enhancedCorrections) {
        // Fallback to enhanced corrections if grammar chips not available
        html += window.enhancedCorrections.processCorrections(payload.corrections);
      } else {
        // Fallback to basic corrections
        html += '<div class="corrections">';
        html += '<div style="margin-top: 0.5rem; font-weight: 500;">Corrections:</div>';

        payload.corrections.forEach((correction, index) => {
          html += `<span class="correction-chip" onclick="toggleCorrection(${index})" data-correction-index="${index}">
                      ${correction.before} → ${correction.after}
                  </span>`;
        });
        html += '</div>';

        // Add correction details (hidden by default)
        payload.corrections.forEach((correction, index) => {
          html += `<div class="correction-details" id="correction-${index}">
                      <strong>Error:</strong> ${correction.type}<br>
                      <strong>Note:</strong> ${correction.note}
                  </div>`;
        });
      }
    }

    // Add drills if any - with interactive practice option
    if (html && payload.drills && payload.drills.length > 0) {
      html += '<div class="drills-section">';
      html +=
        '<div style="font-weight: 500; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">';
      html += '<span>Practice Drills:</span>';
      html +=
        '<button class="btn btn-primary start-drill-practice" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;">🎯 Start Interactive Practice</button>';
      html += '</div>';

      for (const drill of payload.drills) {
        html += `<div class="drill-item">
                    <div class="drill-prompt">${drill.prompt_bg}</div>
                    <div class="drill-answer">Answer: ${drill.answer_bg}</div>
                </div>`;
      }
      html += '</div>';

      // Store drills for interactive practice
      window.currentDrills = payload.drills;
    }

    // Only update innerHTML if html is not null (grammar chips handle their own rendering)
    if (html) {
      coachLine.innerHTML = html;
      this.transcriptArea.appendChild(coachLine);
    }
    this.scrollToBottom();

    // Store for playback
    this.lastResponseText = payload.reply_bg;
    this.playLastBtn.disabled = false;
  }

  async playLastResponse() {
    if (!this.lastResponseText) return;

    try {
      this.playLastBtn.disabled = true;
      this.playLastBtn.textContent = '🔄 Loading...';

      const response = await fetch(`/tts?text=${encodeURIComponent(this.lastResponseText)}`);
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
    this.transcriptArea.innerHTML = `
            <div style="text-align: center; color: #999; padding: 2rem;">
                Start speaking to practice Bulgarian...
            </div>
        `;
    this.playLastBtn.disabled = true;
    this.lastResponseText = '';
  }

  scrollToBottom() {
    this.transcriptArea.scrollTop = this.transcriptArea.scrollHeight;
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
