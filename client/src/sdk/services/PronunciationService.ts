/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
import type { PracticeWordsRequest } from '../models/PracticeWordsRequest';
import type { PracticeWordsResponse } from '../models/PracticeWordsResponse';
import type { PronunciationAnalysis } from '../models/PronunciationAnalysis';
import type { PronunciationRequest } from '../models/PronunciationRequest';
export class PronunciationService {
  /**
   * Analyze Pronunciation
   * Analyze pronunciation quality of audio against reference text.
   *
   * This endpoint provides phoneme-level pronunciation assessment using WhisperX
   * for word-level timestamps and phoneme alignment. Returns detailed scoring
   * with visual feedback data for the frontend.
   * @param requestBody
   * @returns PronunciationAnalysis Successful Response
   * @throws ApiError
   */
  public static analyzePronunciationPronunciationAnalyzePost(
    requestBody: PronunciationRequest
  ): CancelablePromise<PronunciationAnalysis> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/pronunciation/analyze',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Unprocessable Entity`,
        503: `Service Unavailable`,
      },
    });
  }
  /**
   * Get Practice Words
   * Get practice words for a specific Bulgarian phoneme.
   *
   * Returns a list of Bulgarian words that contain the target phoneme,
   * suitable for pronunciation practice at the specified difficulty level.
   * @param phoneme
   * @param difficultyLevel
   * @returns PracticeWordsResponse Successful Response
   * @throws ApiError
   */
  public static getPracticeWordsPronunciationPracticeWordsPhonemeGet(
    phoneme: string,
    difficultyLevel: number = 1
  ): CancelablePromise<PracticeWordsResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/pronunciation/practice-words/{phoneme}',
      path: {
        phoneme: phoneme,
      },
      query: {
        difficulty_level: difficultyLevel,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Get Practice Words Post
   * Get practice words for a specific Bulgarian phoneme (POST version).
   *
   * Alternative endpoint that accepts a JSON request body for more complex
   * practice word selection logic.
   * @param requestBody
   * @returns PracticeWordsResponse Successful Response
   * @throws ApiError
   */
  public static getPracticeWordsPostPronunciationPracticeWordsPost(
    requestBody: PracticeWordsRequest
  ): CancelablePromise<PracticeWordsResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/pronunciation/practice-words',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Get Pronunciation Status
   * Get pronunciation scoring system status.
   *
   * Returns information about whether pronunciation scoring is enabled
   * and what features are available.
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getPronunciationStatusPronunciationStatusGet(): CancelablePromise<
    Record<string, any>
  > {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/pronunciation/status',
    });
  }
}
