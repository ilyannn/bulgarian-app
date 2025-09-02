/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
import type { TTSProfilesResponse } from '../models/TTSProfilesResponse';
export class TtsService {
  /**
   * Text To Speech
   * Convert text to speech and stream audio with optional voice profile
   * @param text
   * @param trackTiming
   * @param profile
   * @returns any Successful Response
   * @throws ApiError
   */
  public static textToSpeechTtsGet(
    text: string,
    trackTiming: boolean = false,
    profile?: string | null
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/tts',
      query: {
        text: text,
        track_timing: trackTiming,
        profile: profile,
      },
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
  /**
   * Get Tts Profiles
   * Get available TTS voice profiles
   * @returns TTSProfilesResponse Successful Response
   * @throws ApiError
   */
  public static getTtsProfilesTtsProfilesGet(): CancelablePromise<TTSProfilesResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/tts/profiles',
    });
  }
}
