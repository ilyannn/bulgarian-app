/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HealthCheckItem } from './HealthCheckItem';
/**
 * Health Check Response Format following RFC draft
 */
export type HealthCheckResponse = {
  /**
   * Overall status: pass/fail/warn
   */
  status: string;
  /**
   * Public version of the service
   */
  version?: string | null;
  /**
   * Internal release identifier
   */
  releaseId?: string | null;
  /**
   * Unique service identifier
   */
  serviceId?: string | null;
  /**
   * Human-friendly description
   */
  description?: string | null;
  /**
   * Individual health checks
   */
  checks?: Record<string, HealthCheckItem> | null;
  /**
   * Raw error output for warn/fail states
   */
  output?: string | null;
  /**
   * Array of notes relevant to health
   */
  notes?: Array<string> | null;
  /**
   * Links with more health information
   */
  links?: Record<string, string> | null;
};
