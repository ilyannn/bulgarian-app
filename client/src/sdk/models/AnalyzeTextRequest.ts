/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request to analyze Bulgarian text for grammar errors
 */
export type AnalyzeTextRequest = {
  /**
   * Bulgarian text to analyze
   */
  text: string;
  /**
   * L1 language code for contrasts
   */
  l1?: string | null;
};
