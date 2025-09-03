/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Phoneme-level pronunciation score
 */
export type PhonemeScore = {
  /**
   * Phoneme symbol
   */
  phoneme: string;
  /**
   * Pronunciation score (0.0-1.0)
   */
  score: number;
  /**
   * Phoneme difficulty level (1-4)
   */
  difficulty: number;
  /**
   * Start time in seconds
   */
  start_time: number;
  /**
   * End time in seconds
   */
  end_time: number;
  /**
   * IPA representation
   */
  ipa: string;
};
