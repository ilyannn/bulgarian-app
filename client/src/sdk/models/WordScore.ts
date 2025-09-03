/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PhonemeScore } from './PhonemeScore';
/**
 * Word-level pronunciation score
 */
export type WordScore = {
  /**
   * The word
   */
  word: string;
  /**
   * Overall word score (0.0-1.0)
   */
  score: number;
  /**
   * Start time in seconds
   */
  start_time: number;
  /**
   * End time in seconds
   */
  end_time: number;
  /**
   * Phoneme-level scores
   */
  phonemes: Array<PhonemeScore>;
  /**
   * Problematic phonemes
   */
  problem_phonemes: Array<string>;
  /**
   * Overall word difficulty
   */
  difficulty: number;
};
