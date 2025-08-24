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
  }

  async initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/asr`;

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.updateConnectionStatus('connected', 'Connected');
        console.log('WebSocket connected');
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');
        console.log('WebSocket disconnected');

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            this.initializeWebSocket();
          }
        }, 3000);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('error', 'Connection Error');
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.updateConnectionStatus('error', 'Connection Failed');
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
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
      });

      // Load audio worklet
      await this.audioContext.audioWorklet.addModule('./audio-worklet.js');

      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'voice-processor');

      // Connect audio graph
      this.sourceNode.connect(this.workletNode);

      // Handle worklet messages
      this.workletNode.port.onmessage = (event) => {
        this.handleWorkletMessage(event.data);
      };

      this.updateAudioStatus('ready', 'Audio: Ready');
      console.log('Audio initialized successfully');
    } catch (error) {
      console.error('Audio initialization failed:', error);
      this.updateAudioStatus('error', 'Audio: Failed');

      // Fallback to ScriptProcessor for older browsers
      await this.initializeAudioFallback();
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

    // Add corrections if any
    if (payload.corrections && payload.corrections.length > 0) {
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

    // Add drills if any
    if (payload.drills && payload.drills.length > 0) {
      html += '<div class="drills-section">';
      html += '<div style="font-weight: 500; margin-bottom: 0.5rem;">Practice Drills:</div>';

      for (const drill of payload.drills) {
        html += `<div class="drill-item">
                    <div class="drill-prompt">${drill.prompt_bg}</div>
                    <div class="drill-answer">Answer: ${drill.answer_bg}</div>
                </div>`;
      }
      html += '</div>';
    }

    coachLine.innerHTML = html;
    this.transcriptArea.appendChild(coachLine);
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

  showError(message) {
    // Simple error display - in production you'd want a proper notification system
    alert(`Error: ${message}`);
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

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.voiceCoach && window.voiceCoach.isRecording) {
    window.voiceCoach.stopRecording();
  }
});
