/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PhonemeScore } from './PhonemeScore';
import type { VisualFeedback } from './VisualFeedback';
import type { WordScore } from './WordScore';
/**
 * Complete pronunciation analysis results
 */
export type PronunciationAnalysis = {
  /**
   * Overall pronunciation score (0.0-1.0)
   */
  overall_score: number;
  /**
   * Per-word pronunciation scores
   */
  word_scores: Array<WordScore>;
  /**
   * Per-phoneme scores
   */
  phoneme_scores: Array<PhonemeScore>;
  /**
   * Problematic phonemes identified
   */
  problem_phonemes: Array<string>;
  /**
   * What was actually transcribed
   */
  transcribed_text: string;
  /**
   * Expected reference text
   */
  reference_text: string;
  /**
   * Data for visual components
   */
  visual_feedback: VisualFeedback;
  /**
   * Improvement suggestions
   */
  suggestions: Array<string>;
  /**
   * Analysis confidence level
   */
  confidence: number;
};
