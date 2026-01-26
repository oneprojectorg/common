/**
 * E2E test fixtures for Playwright.
 *
 * This module exports the test fixtures that provide:
 * - testData: Test data management with automatic cleanup
 * - authenticatedPage: A page with an authenticated user session
 * - authenticatedUser: The user credentials used for authentication
 */

// Re-export from auth.ts
export { test, expect } from './auth.js';

// Re-export TestOrganizationDataManager for custom fixtures
export { TestOrganizationDataManager } from '@op/api/test/helpers/TestOrganizationDataManager';
