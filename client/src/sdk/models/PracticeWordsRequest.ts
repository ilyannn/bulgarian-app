/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for practice words for a specific phoneme
 */
export type PracticeWordsRequest = {
  /**
   * Target phoneme to practice
   */
  phoneme: string;
  /**
   * Difficulty level (1-4)
   */
  difficulty_level?: number;
};
