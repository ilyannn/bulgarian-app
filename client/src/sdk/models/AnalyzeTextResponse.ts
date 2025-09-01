/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DrillSuggestion } from './DrillSuggestion';
import type { GrammarCorrection } from './GrammarCorrection';
/**
 * Response from text analysis with corrections and drill suggestions
 */
export type AnalyzeTextResponse = {
  /**
   * Original text that was analyzed
   */
  text: string;
  /**
   * Grammar corrections found
   */
  corrections: Array<GrammarCorrection>;
  /**
   * Suggested practice drills
   */
  drill_suggestions: Array<DrillSuggestion>;
  /**
   * L1 language used for contrasts
   */
  l1_language: string;
};
