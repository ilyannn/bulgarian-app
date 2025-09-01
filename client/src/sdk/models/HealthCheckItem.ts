/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Individual health check item (RFC compliant)
 */
export type HealthCheckItem = {
  /**
   * Check status: pass/fail/warn
   */
  status: string;
  /**
   * Type of component being checked
   */
  componentType?: string | null;
  /**
   * Observed value for this check
   */
  observedValue?: boolean | string | null;
  /**
   * Unit of observed value
   */
  observedUnit?: string | null;
  /**
   * Human-readable output message
   */
  output?: string | null;
  /**
   * RFC 3339 timestamp
   */
  time?: string | null;
};
