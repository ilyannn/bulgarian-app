/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Standard error response format for API consistency
 */
export type ErrorResponse = {
  /**
   * Error type or code
   */
  error: string;
  /**
   * Human-readable error message
   */
  message: string;
  /**
   * Additional error details
   */
  details?: Record<string, any> | null;
};
