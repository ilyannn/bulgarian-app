/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AppConfigResponse } from '../models/AppConfigResponse';
import type { UpdateL1Request } from '../models/UpdateL1Request';
import type { UpdateL1Response } from '../models/UpdateL1Response';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ConfigService {
  /**
   * Get App Config
   * Get current application configuration for frontend
   * @returns AppConfigResponse Successful Response
   * @throws ApiError
   */
  public static getAppConfigApiConfigGet(): CancelablePromise<AppConfigResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/config',
    });
  }
  /**
   * Update L1 Language
   * Update L1 language preference (session-based, not persistent)
   * @param requestBody
   * @returns UpdateL1Response Successful Response
   * @throws ApiError
   */
  public static updateL1LanguageApiConfigL1Post(
    requestBody: UpdateL1Request
  ): CancelablePromise<UpdateL1Response> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/config/l1',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Unprocessable Entity`,
      },
    });
  }
}
