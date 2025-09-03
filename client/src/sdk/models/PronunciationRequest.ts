/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for pronunciation analysis
 */
export type PronunciationRequest = {
  /**
   * Base64 encoded audio data (16kHz, mono)
   */
  audio_data: string;
  /**
   * Expected text for comparison
   */
  reference_text: string;
  /**
   * Audio sample rate
   */
  sample_rate?: number;
};
