/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Visual feedback data for pronunciation display
 */
export type VisualFeedback = {
  /**
   * Timeline visualization data
   */
  timeline: Array<Record<string, any>>;
  /**
   * Phoneme difficulty heatmap
   */
  phoneme_heatmap: Record<string, Record<string, any>>;
  /**
   * Total audio length in seconds
   */
  audio_length: number;
};
