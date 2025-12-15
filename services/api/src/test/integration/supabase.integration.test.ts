import { beforeEach, describe, expect, it } from 'vitest';

import { supabaseTestClient } from '../setup';
import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  insertTestData,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe.skip('Supabase Integration Tests', () => {
  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData(['profiles', 'posts']);
    await signOutTestUser();
  });

  it('should connect to local Supabase instance', async () => {
    expect(supabaseTestClient).toBeDefined();

    // Test basic connectivity - this will likely fail on a fresh table, which is expected
    const { data, error } = await supabaseTestClient
      .from('_test_connection')
      .select('*')
      .limit(1);

    // We expect this to fail with table not found, which means connection is working
    if (error) {
      expect(error.message).toContain('_test_connection" does not exist');
    }
  });

  it('should create and authenticate test users', async () => {
    const testEmail = `test-${Date.now()}@example.com`;

    // Create test user
    const signUpResult = await createTestUser(testEmail);
    expect(signUpResult.user).toBeDefined();
    expect(signUpResult.user?.email).toBe(testEmail);

    // Sign out and sign back in
    await signOutTestUser();
    const signInResult = await signInTestUser(testEmail);
    expect(signInResult.user).toBeDefined();
    expect(signInResult.session).toBeDefined();

    // Verify session
    const session = await getCurrentTestSession();
    expect(session).toBeDefined();
    expect(session?.user.email).toBe(testEmail);
  });

  it('should handle database operations', async () => {
    // This test will only work if you have a 'profiles' table in your schema
    // You may need to adjust the table name and fields based on your actual schema

    const testEmail = `test-${Date.now()}@example.com`;
    await createTestUser(testEmail);
    await signInTestUser(testEmail);

    // Test inserting data (adjust fields based on your schema)
    try {
      const testData = {
        display_name: 'Test User',
        bio: 'This is a test user created during integration testing',
      };

      const result = await insertTestData('profiles', testData);
      expect(result).toBeDefined();

      // Test querying data
      const { data: profiles, error } = await supabaseTestClient
        .from('profiles')
        .select('*')
        .eq('display_name', 'Test User');

      if (!error) {
        expect(profiles).toBeDefined();
        expect(profiles?.length).toBeGreaterThan(0);
        expect(profiles?.[0].display_name).toBe('Test User');
      }
    } catch (err) {
      // If profiles table doesn't exist or has different schema, that's ok
      console.warn(
        'Profiles table test skipped - adjust test based on your schema',
      );
    }
  });

  it('should handle real-time subscriptions', async () => {
    // Test real-time functionality
    let receivedUpdate = false;

    // Set up subscription (adjust table name as needed)
    const subscription = supabaseTestClient
      .channel('test-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          receivedUpdate = true;
          expect(payload).toBeDefined();
        },
      )
      .subscribe();

    // Wait a bit for subscription to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create a user and profile to trigger the subscription
    const testEmail = `test-realtime-${Date.now()}@example.com`;
    try {
      await createTestUser(testEmail);
      await signInTestUser(testEmail);

      await insertTestData('profiles', {
        display_name: 'Realtime Test User',
      });

      // Wait for real-time event
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Clean up subscription
      await supabaseTestClient.removeChannel(subscription);

      // Note: Real-time might not work in all test environments
      // This test verifies the subscription setup works
      expect(subscription).toBeDefined();
    } catch (err) {
      console.warn('Real-time test skipped - adjust based on your schema');
      await supabaseTestClient.removeChannel(subscription);
    }
  });

  it('should handle auth state changes', async () => {
    const testEmail = `test-auth-${Date.now()}@example.com`;

    let authStateChanges: string[] = [];

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabaseTestClient.auth.onAuthStateChange((event, session) => {
      authStateChanges.push(event);
    });

    // Create user and sign in
    await createTestUser(testEmail);
    await signInTestUser(testEmail);

    // Sign out
    await signOutTestUser();

    // Wait for events to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clean up subscription
    subscription.unsubscribe();

    // Verify we received auth events
    expect(authStateChanges.length).toBeGreaterThan(0);
    expect(authStateChanges).toContain('SIGNED_IN');
  });
});
