/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Application configuration response
 */
export type AppConfigResponse = {
  /**
   * Default L1 language
   */
  l1_language: string;
  /**
   * Supported L1 language codes
   */
  supported_languages: Array<string>;
  /**
   * Language code to display name mapping
   */
  language_names: Record<string, string>;
};
