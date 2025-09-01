/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Grammar drill suggestion with L1 contrast
 */
export type DrillSuggestion = {
  /**
   * Grammar rule identifier
   */
  grammar_id: string;
  /**
   * Micro-explanation in Bulgarian
   */
  explanation: string;
  /**
   * L1-specific contrast note
   */
  contrast_note?: string | null;
  /**
   * Practice drills for this grammar point
   */
  drills: Array<Record<string, any>>;
};
