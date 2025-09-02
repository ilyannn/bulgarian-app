/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
import type { HealthCheckResponse } from '../models/HealthCheckResponse';
export class HealthService {
  /**
   * Root
   * Root endpoint - returns API information
   * @returns any Successful Response
   * @throws ApiError
   */
  public static rootGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/',
    });
  }
  /**
   * Health Check
   * Health check endpoint following RFC Health Check Response Format
   *
   * Returns health status in application/health+json format according to
   * the Health Check Response Format for HTTP APIs RFC draft.
   * @returns HealthCheckResponse Service is healthy
   * @throws ApiError
   */
  public static healthCheckHealthGet(): CancelablePromise<HealthCheckResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/health',
      errors: {
        503: `Service is unhealthy`,
      },
    });
  }
}
