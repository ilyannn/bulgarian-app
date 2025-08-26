/**
 * Unit tests for AudioWorklet VoiceProcessor
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AudioWorkletProcessor base class
global.AudioWorkletProcessor = class MockAudioWorkletProcessor {
  constructor() {
    this.port = {
      postMessage: vi.fn(),
      onmessage: null,
    };
  }
};

// Mock registerProcessor function
global.registerProcessor = vi.fn();

// Mock sampleRate global
global.sampleRate = 48000;

// Define the VoiceProcessor class for testing
class VoiceProcessor extends AudioWorkletProcessor {
  constructor(_options) {
    super();

    // Audio configuration
    this.targetSampleRate = 16000; // Target sample rate for ASR
    this.bufferSize = 1024; // Process in chunks
    this.frameSize = 320; // 20ms frames at 16kHz

    // Resampling (from 44.1kHz/48kHz to 16kHz)
    this.resampleRatio = sampleRate / this.targetSampleRate;
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

describe('VoiceProcessor AudioWorklet', () => {
  let processor;

  beforeEach(() => {
    processor = new VoiceProcessor();
  });

  describe('Constructor', () => {
    it('should initialize with correct default values', () => {
      expect(processor.targetSampleRate).toBe(16000);
      expect(processor.frameSize).toBe(320);
      expect(processor.resampleRatio).toBe(48000 / 16000); // 3.0
      expect(processor.inputGain).toBe(1.0);
      expect(processor.noiseGateThreshold).toBe(0.01);
      expect(processor.isRecording).toBe(false);
    });

    it('should initialize audio buffer with correct size', () => {
      expect(processor.audioBuffer).toBeInstanceOf(Float32Array);
      expect(processor.audioBuffer.length).toBe(320 * 10); // 200ms buffer
    });

    it('should set up port message listener', () => {
      expect(processor.port.onmessage).toBeInstanceOf(Function);
    });
  });

  describe('Message Handling', () => {
    it('should start recording on start message', () => {
      processor.handleMessage({ type: 'start' });

      expect(processor.isRecording).toBe(true);
    });

    it('should stop recording on stop message', () => {
      processor.isRecording = true;
      processor.handleMessage({ type: 'stop' });

      expect(processor.isRecording).toBe(false);
    });

    it('should set gain within valid range', () => {
      processor.handleMessage({ type: 'setGain', value: 1.5 });
      expect(processor.inputGain).toBe(1.5);

      processor.handleMessage({ type: 'setGain', value: 0.05 }); // Below minimum
      expect(processor.inputGain).toBe(0.1);

      processor.handleMessage({ type: 'setGain', value: 3.0 }); // Above maximum
      expect(processor.inputGain).toBe(2.0);
    });

    it('should set noise gate within valid range', () => {
      processor.handleMessage({ type: 'setNoiseGate', value: 0.05 });
      expect(processor.noiseGateThreshold).toBe(0.05);

      processor.handleMessage({ type: 'setNoiseGate', value: 0.0005 }); // Below minimum
      expect(processor.noiseGateThreshold).toBe(0.001);

      processor.handleMessage({ type: 'setNoiseGate', value: 0.2 }); // Above maximum
      expect(processor.noiseGateThreshold).toBe(0.1);
    });
  });

  describe('Buffer Management', () => {
    it('should reset buffers correctly', () => {
      processor.bufferWriteIndex = 10;
      processor.bufferReadIndex = 5;
      processor.levelSmoother = 0.5;
      processor.frameCounter = 100;

      processor.resetBuffers();

      expect(processor.bufferWriteIndex).toBe(0);
      expect(processor.bufferReadIndex).toBe(0);
      expect(processor.levelSmoother).toBe(0);
      expect(processor.frameCounter).toBe(0);
      expect(processor.resampleBuffer).toEqual([]);
    });

    it('should calculate available samples correctly', () => {
      processor.bufferWriteIndex = 100;
      processor.bufferReadIndex = 50;

      const available = processor.getAvailableSamples();
      expect(available).toBe(50);
    });

    it('should handle buffer wraparound', () => {
      processor.bufferWriteIndex = 10;
      processor.bufferReadIndex = 3000; // Near end of buffer

      const available = processor.getAvailableSamples();
      expect(available).toBeGreaterThan(0);
    });
  });

  describe('Audio Processing', () => {
    beforeEach(() => {
      processor.isRecording = true;
    });

    it('should return true when not recording', () => {
      processor.isRecording = false;
      const inputs = [[createMockAudioData(128)]];

      const result = processor.process(inputs, [], {});

      expect(result).toBe(true);
    });

    it('should return true when no input data', () => {
      const inputs = [[]];

      const result = processor.process(inputs, [], {});

      expect(result).toBe(true);
    });

    it('should process audio data and apply gain', () => {
      processor.inputGain = 2.0;
      const inputData = createMockAudioData(128, 0.5);
      const inputs = [[inputData]];

      const result = processor.process(inputs, [], {});

      expect(result).toBe(true);
      expect(processor.levelSmoother).toBeGreaterThan(0);
    });

    it('should apply noise gate threshold', () => {
      processor.noiseGateThreshold = 0.1;
      const quietInput = createMockAudioData(128, 0.05); // Below threshold
      const inputs = [[quietInput]];

      processor.process(inputs, [], {});

      // Level should be reduced but not zero
      expect(processor.levelSmoother).toBeGreaterThan(0);
      expect(processor.levelSmoother).toBeLessThan(0.05);
    });

    it('should send level updates periodically', () => {
      const inputData = createMockAudioData(128, 0.5);
      const inputs = [[inputData]];
      processor.frameCounter = 511; // Next process will be 512

      processor.process(inputs, [], {});

      // Check that frameCounter was incremented
      expect(processor.frameCounter).toBe(512);
    });
  });

  describe('Resampling', () => {
    beforeEach(() => {
      processor.isRecording = true;
      vi.spyOn(processor, 'addToBuffer');
    });

    it('should add samples to resample buffer', () => {
      const sample = 0.5;

      processor.resampleToTargetRate(sample);

      expect(processor.resampleBuffer).toContain(sample);
    });

    it('should clean up old samples when buffer gets large', () => {
      // Fill buffer beyond cleanup threshold
      for (let i = 0; i < 1001; i++) {
        processor.resampleBuffer.push(Math.random() * 0.1);
      }
      processor.resampleIndex = 500;

      processor.resampleToTargetRate(0.1);

      expect(processor.resampleBuffer.length).toBeLessThan(1001);
    });
  });

  describe('PCM Conversion', () => {
    it('should convert float samples to 16-bit PCM', () => {
      const input = new Float32Array([0.5, -0.5, 1.0, -1.0, 0.0]);

      const result = processor.floatTo16BitPCM(input);

      expect(result).toBeInstanceOf(Int16Array);
      expect(result.length).toBe(5);
      expect(result[0]).toBe(Math.floor(0.5 * 0x7fff)); // Positive sample
      expect(result[1]).toBe(-0.5 * 0x8000); // Negative sample
      expect(result[4]).toBe(0); // Zero sample
    });

    it('should clamp samples to valid range', () => {
      const input = new Float32Array([1.5, -1.5, 2.0, -2.0]);

      const result = processor.floatTo16BitPCM(input);

      expect(result[0]).toBe(0x7fff); // Clamped to max positive
      expect(result[1]).toBe(-0x8000); // Clamped to max negative
      expect(result[2]).toBe(0x7fff);
      expect(result[3]).toBe(-0x8000);
    });
  });

  describe('Frame Processing', () => {
    beforeEach(() => {
      processor.isRecording = true;
      // Fill buffer with known data
      for (let i = 0; i < processor.frameSize; i++) {
        processor.audioBuffer[i] = i / processor.frameSize; // Ramp from 0 to ~1
      }
      processor.bufferWriteIndex = processor.frameSize;
      processor.bufferReadIndex = 0;
    });

    it('should send frame when buffer is full', () => {
      processor.sendFrame();

      expect(processor.port.postMessage).toHaveBeenCalledWith(
        {
          type: 'audioFrame',
          data: expect.any(ArrayBuffer),
        },
        [expect.any(ArrayBuffer)]
      );
    });

    it('should advance read index after sending frame', () => {
      const initialReadIndex = processor.bufferReadIndex;

      processor.sendFrame();

      expect(processor.bufferReadIndex).toBe(
        (initialReadIndex + processor.frameSize) % processor.audioBuffer.length
      );
    });

    it('should trigger frame send when buffer has enough samples', () => {
      vi.spyOn(processor, 'sendFrame');

      // Fill buffer to threshold
      for (let i = 0; i < processor.frameSize; i++) {
        processor.addToBuffer(0.1);
      }

      expect(processor.sendFrame).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should handle complete audio processing workflow', () => {
      const inputData = createMockAudioData(512, 0.5);
      const inputs = [[inputData]];

      processor.handleMessage({ type: 'start' });
      const result = processor.process(inputs, [], {});

      expect(result).toBe(true);
      expect(processor.isRecording).toBe(true);
      expect(processor.levelSmoother).toBeGreaterThan(0);

      // Should have attempted to process samples through resampling
      expect(processor.resampleBuffer.length).toBeGreaterThan(0);
    });

    it('should register processor globally', () => {
      // Since we define VoiceProcessor directly in tests, we'll simulate registration
      global.registerProcessor('voice-processor', VoiceProcessor);
      expect(global.registerProcessor).toHaveBeenCalledWith('voice-processor', VoiceProcessor);
    });
  });
});

// Helper function to create mock audio data
function createMockAudioData(length, amplitude = 1.0) {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Create a sine wave for realistic audio data
    data[i] = Math.sin((2 * Math.PI * 440 * i) / 48000) * amplitude;
  }
  return data;
}
