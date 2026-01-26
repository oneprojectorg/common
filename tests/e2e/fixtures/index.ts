/**
 * E2E test fixtures for Playwright.
 *
 * This module exports the test fixtures that provide:
 * - authenticatedPage: A page with an authenticated user session
 * - authenticatedUser: The user credentials used for authentication
 */

export { test, expect, TEST_USER_DEFAULT_PASSWORD } from './auth';
export { createOrganization, createUser } from './test-data';
