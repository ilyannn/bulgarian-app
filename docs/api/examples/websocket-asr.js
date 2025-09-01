/**
 * WebSocket ASR Integration Example
 * 
 * This example shows how to implement real-time speech recognition
 * using the WebSocket API for continuous Bulgarian speech processing.
 */

class BulgarianASRClient {
  constructor(baseUrl = 'ws://localhost:8000') {
    this.baseUrl = baseUrl;
    this.ws = null;
    this.isRecording = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    
    // Callbacks for different events
    this.onPartialResult = (text) => console.log('Partial:', text);
    this.onFinalResult = (text, confidence) => console.log('Final:', text, `(${confidence})`);
    this.onError = (error) => console.error('ASR Error:', error);
    this.onConnected = () => console.log('🎤 ASR WebSocket connected');
    this.onDisconnected = () => console.log('🔌 ASR WebSocket disconnected');
  }
  
  /**
   * Connect to the ASR WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${this.baseUrl}/ws/asr`);
      
      this.ws.onopen = () => {
        this.onConnected();
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data);
          this.handleASRResult(result);
        } catch (error) {
          this.onError(`Failed to parse ASR result: ${error.message}`);
        }
      };
      
      this.ws.onclose = () => {
        this.onDisconnected();
        this.cleanup();
      };
      
      this.ws.onerror = (error) => {
        this.onError(`WebSocket error: ${error.message}`);
        reject(error);
      };
    });
  }
  
  /**
   * Handle different types of ASR results
   */
  handleASRResult(result) {
    switch (result.type) {
      case 'partial':
        this.onPartialResult(result.text);
        break;
        
      case 'final':
        this.onFinalResult(result.text, result.confidence);
        break;
        
      case 'error':
        this.onError(result.error);
        break;
        
      default:
        console.warn('Unknown ASR result type:', result.type);
    }
  }
  
  /**
   * Start recording and sending audio to ASR
   */
  async startRecording() {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }
    
    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,  // Bulgarian ASR expects 16kHz
          channelCount: 1,    // Mono audio
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use ScriptProcessorNode for compatibility (deprecated but widely supported)
      // In production, consider using AudioWorklet for better performance
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (event) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const audioData = event.inputBuffer.getChannelData(0);
          // Send Float32Array as binary data
          this.ws.send(audioData.buffer);
        }
      };
      
      // Connect audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      this.isRecording = true;
      console.log('🎙️ Recording started');
      
    } catch (error) {
      this.onError(`Failed to start recording: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.isRecording) {
      console.warn('Not currently recording');
      return;
    }
    
    this.cleanup();
    this.isRecording = false;
    console.log('🛑 Recording stopped');
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopRecording();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Example usage
async function main() {
  console.log('🚀 Bulgarian ASR WebSocket Example');
  
  const asr = new BulgarianASRClient();
  
  // Set up event handlers
  let transcriptBuffer = [];
  
  asr.onPartialResult = (text) => {
    console.log(`📝 Partial: "${text}"`);
    // Update UI with partial results
    document.getElementById('partial-transcript')?.textContent = text;
  };
  
  asr.onFinalResult = (text, confidence) => {
    console.log(`✅ Final: "${text}" (confidence: ${confidence?.toFixed(2) || 'unknown'})`);
    transcriptBuffer.push(text);
    
    // Update UI with final results
    const transcriptEl = document.getElementById('final-transcript');
    if (transcriptEl) {
      transcriptEl.textContent = transcriptBuffer.join(' ');
    }
    
    // Clear partial display
    document.getElementById('partial-transcript')?.textContent = '';
  };
  
  asr.onError = (error) => {
    console.error('❌ ASR Error:', error);
    document.getElementById('error-display')?.textContent = error;
  };
  
  try {
    // Connect to WebSocket
    await asr.connect();
    
    // Create simple UI controls
    const controls = createControls(asr);
    document.body.appendChild(controls);
    
    console.log('🎤 Ready to record! Click "Start Recording" to begin.');
    
  } catch (error) {
    console.error('Failed to initialize ASR:', error);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    asr.disconnect();
  });
}

/**
 * Create simple UI controls for the example
 */
function createControls(asr) {
  const container = document.createElement('div');
  container.style.cssText = `
    font-family: Arial, sans-serif;
    max-width: 600px;
    margin: 20px auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
  `;
  
  container.innerHTML = `
    <h2>🎤 Bulgarian Voice Recognition</h2>
    
    <div style="margin: 15px 0;">
      <button id="start-btn" style="background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-right: 10px;">
        Start Recording
      </button>
      <button id="stop-btn" style="background: #f44336; color: white; padding: 10px 20px; border: none; border-radius: 4px;" disabled>
        Stop Recording
      </button>
    </div>
    
    <div style="margin: 15px 0;">
      <strong>Status:</strong> <span id="status">Ready</span>
    </div>
    
    <div style="margin: 15px 0;">
      <strong>Partial:</strong> <span id="partial-transcript" style="color: #666; font-style: italic;"></span>
    </div>
    
    <div style="margin: 15px 0;">
      <strong>Final:</strong> <div id="final-transcript" style="background: #f9f9f9; padding: 10px; border-radius: 4px; min-height: 40px;"></div>
    </div>
    
    <div id="error-display" style="color: red; margin: 15px 0;"></div>
    
    <div style="font-size: 12px; color: #666; margin-top: 20px;">
      💡 Tip: Speak clearly in Bulgarian. The system works best with short phrases.
    </div>
  `;
  
  // Wire up controls
  const startBtn = container.querySelector('#start-btn');
  const stopBtn = container.querySelector('#stop-btn');
  const statusEl = container.querySelector('#status');
  
  startBtn.addEventListener('click', async () => {
    try {
      await asr.startRecording();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusEl.textContent = 'Recording...';
      statusEl.style.color = 'green';
    } catch (error) {
      container.querySelector('#error-display').textContent = `Failed to start: ${error.message}`;
    }
  });
  
  stopBtn.addEventListener('click', () => {
    asr.stopRecording();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusEl.textContent = 'Stopped';
    statusEl.style.color = 'red';
  });
  
  return container;
}

// Run the example if this script is loaded directly
if (typeof window !== 'undefined') {
  // Browser environment
  document.addEventListener('DOMContentLoaded', main);
} else {
  // Node.js environment (for testing)
  console.log('This example is designed to run in a browser environment.');
  console.log('Open this file in a browser with the dev server running.');
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BulgarianASRClient, main };
}