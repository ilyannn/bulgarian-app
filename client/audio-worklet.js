/**
 * Audio Worklet for real-time audio processing and streaming
 * Captures 16kHz mono PCM and sends to WebSocket
 */

class VoiceProcessor extends AudioWorkletProcessor {
  constructor(_options) {
    super();

    // Audio configuration
    this.sampleRate = 16000; // Target sample rate for ASR
    this.bufferSize = 1024; // Process in chunks
    this.frameSize = 320; // 20ms frames at 16kHz

    // Resampling (from 44.1kHz/48kHz to 16kHz)
    this.resampleRatio = sampleRate / this.sampleRate;
    this.resampleBuffer = [];
    this.resampleIndex = 0;

    // Ring buffer for audio data
    this.audioBuffer = new Float32Array(this.frameSize * 10); // 200ms buffer
    this.bufferWriteIndex = 0;
    this.bufferReadIndex = 0;

    // Audio level calculation
    this.levelSmoother = 0;
    this.levelSmoothingFactor = 0.95;

    // Gain control and noise gate
    this.inputGain = 1.0;
    this.noiseGateThreshold = 0.01;

    // Processing state
    this.isRecording = false;
    this.frameCounter = 0;

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'start':
        this.isRecording = true;
        this.resetBuffers();
        break;
      case 'stop':
        this.isRecording = false;
        break;
      case 'setGain':
        this.inputGain = Math.max(0.1, Math.min(2.0, message.value));
        break;
      case 'setNoiseGate':
        this.noiseGateThreshold = Math.max(0.001, Math.min(0.1, message.value));
        break;
    }
  }

  resetBuffers() {
    this.audioBuffer.fill(0);
    this.bufferWriteIndex = 0;
    this.bufferReadIndex = 0;
    this.resampleBuffer = [];
    this.resampleIndex = 0;
    this.levelSmoother = 0;
    this.frameCounter = 0;
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];

    if (!input || !input[0] || !this.isRecording) {
      return true;
    }

    const inputData = input[0]; // Mono input
    const blockSize = inputData.length;

    // Process each sample
    for (let i = 0; i < blockSize; i++) {
      let sample = inputData[i] * this.inputGain;

      // Apply noise gate
      if (Math.abs(sample) < this.noiseGateThreshold) {
        sample *= 0.1; // Reduce but don't completely eliminate
      }

      // Update level meter
      const sampleLevel = Math.abs(sample);
      this.levelSmoother =
        this.levelSmoother * this.levelSmoothingFactor +
        sampleLevel * (1 - this.levelSmoothingFactor);

      // Resample to 16kHz
      this.resampleToTargetRate(sample);
    }

    // Send level updates periodically
    if (this.frameCounter % 512 === 0) {
      // ~10-20 times per second
      this.port.postMessage({
        type: 'level',
        value: Math.min(1.0, this.levelSmoother * 10), // Scale for display
      });
    }

    this.frameCounter++;
    return true;
  }

  resampleToTargetRate(sample) {
    // Simple linear resampling
    this.resampleBuffer.push(sample);

    while (this.resampleIndex < this.resampleBuffer.length - 1) {
      // Linear interpolation between samples
      const index = this.resampleIndex;
      const fraction = index - Math.floor(index);
      const sample1 = this.resampleBuffer[Math.floor(index)];
      const sample2 = this.resampleBuffer[Math.floor(index) + 1];
      const resampledSample = sample1 + fraction * (sample2 - sample1);

      // Add to ring buffer
      this.addToBuffer(resampledSample);

      this.resampleIndex += this.resampleRatio;
    }

    // Clean up old samples
    if (this.resampleBuffer.length > 1000) {
      const keep = Math.floor(this.resampleIndex);
      this.resampleBuffer = this.resampleBuffer.slice(keep);
      this.resampleIndex -= keep;
    }
  }

  addToBuffer(sample) {
    this.audioBuffer[this.bufferWriteIndex] = sample;
    this.bufferWriteIndex = (this.bufferWriteIndex + 1) % this.audioBuffer.length;

    // Check if we have a complete frame to send
    const available = this.getAvailableSamples();
    if (available >= this.frameSize) {
      this.sendFrame();
    }
  }

  getAvailableSamples() {
    return (
      (this.bufferWriteIndex - this.bufferReadIndex + this.audioBuffer.length) %
      this.audioBuffer.length
    );
  }

  sendFrame() {
    const frame = new Float32Array(this.frameSize);

    // Copy frame from ring buffer
    for (let i = 0; i < this.frameSize; i++) {
      frame[i] = this.audioBuffer[this.bufferReadIndex];
      this.bufferReadIndex = (this.bufferReadIndex + 1) % this.audioBuffer.length;
    }

    // Convert to 16-bit PCM
    const pcmFrame = this.floatTo16BitPCM(frame);

    // Send to main thread
    this.port.postMessage(
      {
        type: 'audioFrame',
        data: pcmFrame.buffer,
      },
      [pcmFrame.buffer]
    );
  }

  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return output;
  }
}

// Register the processor
registerProcessor('voice-processor', VoiceProcessor);
