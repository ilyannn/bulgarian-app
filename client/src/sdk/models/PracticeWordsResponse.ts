/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Practice words for phoneme training
 */
export type PracticeWordsResponse = {
  /**
   * Target phoneme
   */
  phoneme: string;
  /**
   * Recommended practice words
   */
  practice_words: Array<string>;
  /**
   * Requested difficulty level
   */
  difficulty_level: number;
};
