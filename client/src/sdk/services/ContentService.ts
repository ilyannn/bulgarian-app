/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
import type { AnalyzeTextRequest } from '../models/AnalyzeTextRequest';
import type { AnalyzeTextResponse } from '../models/AnalyzeTextResponse';
import type { UserProgress } from '../models/UserProgress';
export class ContentService {
  /**
   * Get Scenarios
   * Get list of available scenarios
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getScenariosContentScenariosGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/content/scenarios',
    });
  }
  /**
   * Get Grammar
   * Get specific grammar item by ID with L1-specific contrast notes
   * @param grammarId
   * @param l1
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getGrammarContentGrammarGrammarIdGet(
    grammarId: string,
    l1?: string | null
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/content/grammar/{grammar_id}',
      path: {
        grammar_id: grammarId,
      },
      query: {
        l1: l1,
      },
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
  /**
   * Get Drills For Grammar
   * Get drills for a specific grammar item with L1-specific contrast
   * @param grammarId
   * @param l1
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getDrillsForGrammarContentDrillsGrammarIdGet(
    grammarId: string,
    l1?: string | null
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/content/drills/{grammar_id}',
      path: {
        grammar_id: grammarId,
      },
      query: {
        l1: l1,
      },
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
  /**
   * Get Mini Lessons
   * Get list of available mini-lessons
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getMiniLessonsContentMiniLessonsGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/content/mini-lessons',
    });
  }
  /**
   * Get Mini Lesson By Id
   * Get specific mini-lesson by ID
   * @param lessonId
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getMiniLessonByIdContentMiniLessonsLessonIdGet(
    lessonId: string
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/content/mini-lessons/{lesson_id}',
      path: {
        lesson_id: lessonId,
      },
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
  /**
   * Get Due Lessons
   * Get mini-lessons due for review based on user's SRS progress
   * @param requestBody
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getDueLessonsContentMiniLessonsDuePost(
    requestBody: UserProgress
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/content/mini-lessons/due',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
  /**
   * Get Lessons For Error
   * Get mini-lessons that match a specific error pattern
   * @param errorPattern
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getLessonsForErrorContentMiniLessonsForErrorErrorPatternGet(
    errorPattern: string
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/content/mini-lessons/for-error/{error_pattern}',
      path: {
        error_pattern: errorPattern,
      },
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
  /**
   * Analyze Text
   * Analyze Bulgarian text for grammar errors and generate drills with L1 contrast
   * @param requestBody
   * @returns AnalyzeTextResponse Successful Response
   * @throws ApiError
   */
  public static analyzeTextContentAnalyzePost(
    requestBody: AnalyzeTextRequest
  ): CancelablePromise<AnalyzeTextResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/content/analyze',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
}
