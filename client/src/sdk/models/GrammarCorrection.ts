/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Individual grammar correction
 */
export type GrammarCorrection = {
  /**
   * Type of grammar error
   */
  type: string;
  /**
   * Original incorrect text
   */
  before: string;
  /**
   * Corrected text
   */
  after: string;
  /**
   * Explanation of the correction
   */
  note: string;
  /**
   * Grammar rule identifier
   */
  error_tag: string;
};
