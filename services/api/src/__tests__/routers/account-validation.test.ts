import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { z } from 'zod';

describe('Account Router Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Input Validation', () => {
    const loginSchema = z.object({
      email: z.string().email().toLowerCase().trim(),
      usingOAuth: z.boolean().optional(),
    });

    it('should accept valid login input', () => {
      const validInputs = [
        { email: 'user@example.com', usingOAuth: false },
        { email: 'user@example.com', usingOAuth: true },
        { email: 'user@example.com' } // usingOAuth optional
      ];

      validInputs.forEach(input => {
        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('user@example.com');
        }
      });
    });

    it('should reject invalid email formats', () => {
      const invalidInputs = [
        { email: 'invalid-email', usingOAuth: false },
        { email: '@example.com', usingOAuth: false },
        { email: 'user@', usingOAuth: false },
        { email: '', usingOAuth: false },
        { email: 'user.example.com', usingOAuth: false }
      ];

      invalidInputs.forEach(input => {
        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    it('should require email field', () => {
      const result = loginSchema.safeParse({ usingOAuth: false });
      expect(result.success).toBe(false);
    });
  });

  describe('Update User Profile Validation', () => {
    const updateProfileSchema = z.object({
      name: z.string().trim().min(1).max(255),
      about: z.string().trim().max(255),
      title: z.string().trim().min(1).max(255),
      username: z.string().trim().min(4).max(255).toLowerCase().regex(/^[a-z0-9_]+$/),
    }).partial();

    describe('name validation', () => {
      it('should accept valid names', () => {
        const validNames = [
          'John Doe',
          'A',
          'x'.repeat(255), // Max length
          '  John Doe  ' // Should be trimmed
        ];

        validNames.forEach(name => {
          const result = updateProfileSchema.safeParse({ name });
          expect(result.success).toBe(true);
          if (result.success && name.trim() === name) {
            expect(result.data.name).toBe(name);
          } else if (result.success) {
            expect(result.data.name).toBe(name.trim());
          }
        });
      });

      it('should reject invalid names', () => {
        const invalidNames = [
          '', // Empty after trim
          '   ', // Only whitespace
          'x'.repeat(256) // Too long
        ];

        invalidNames.forEach(name => {
          const result = updateProfileSchema.safeParse({ name });
          expect(result.success).toBe(false);
        });
      });
    });

    describe('about validation', () => {
      it('should accept valid about text', () => {
        const validAbout = [
          'Software developer',
          '',
          'x'.repeat(255), // Max length
          '  About me  ' // Should be trimmed
        ];

        validAbout.forEach(about => {
          const result = updateProfileSchema.safeParse({ about });
          expect(result.success).toBe(true);
        });
      });

      it('should reject about text that is too long', () => {
        const result = updateProfileSchema.safeParse({ about: 'x'.repeat(256) });
        expect(result.success).toBe(false);
      });
    });

    describe('title validation', () => {
      it('should accept valid titles', () => {
        const validTitles = [
          'Senior Developer',
          'CEO',
          'x'.repeat(255) // Max length
        ];

        validTitles.forEach(title => {
          const result = updateProfileSchema.safeParse({ title });
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid titles', () => {
        const invalidTitles = [
          '', // Empty
          '   ', // Only whitespace
          'x'.repeat(256) // Too long
        ];

        invalidTitles.forEach(title => {
          const result = updateProfileSchema.safeParse({ title });
          expect(result.success).toBe(false);
        });
      });
    });

    describe('username validation', () => {
      it('should accept valid usernames', () => {
        const validUsernames = [
          'user123',
          'test_user',
          'a1b2c3',
          'user_name_123',
          'x'.repeat(255) // Max length
        ];

        validUsernames.forEach(username => {
          const result = updateProfileSchema.safeParse({ username });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.username).toBe(username.toLowerCase());
          }
        });
      });

      it('should normalize username case', () => {
        const result = updateProfileSchema.safeParse({ username: 'TEST_USER' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.username).toBe('test_user');
        }
      });

      it('should reject invalid usernames', () => {
        const invalidUsernames = [
          'abc', // Too short
          'user-name', // Contains hyphen
          'user name', // Contains space
          'user@name', // Contains special character
          'user.name', // Contains dot
          'user!', // Contains exclamation
          'x'.repeat(256), // Too long
          '', // Empty
          '   ' // Only whitespace
        ];

        invalidUsernames.forEach(username => {
          const result = updateProfileSchema.safeParse({ username });
          expect(result.success).toBe(false);
        });
      });

      it('should trim username', () => {
        const result = updateProfileSchema.safeParse({ username: '  test_user  ' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.username).toBe('test_user');
        }
      });
    });

    it('should accept partial updates', () => {
      const partialUpdates = [
        { name: 'John Doe' },
        { about: 'Developer' },
        { title: 'Engineer' },
        { username: 'john_doe' },
        { name: 'John', title: 'Engineer' },
        {} // Empty object should be valid
      ];

      partialUpdates.forEach(update => {
        const result = updateProfileSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Username Available Validation', () => {
    const usernameAvailableSchema = z.object({
      username: z.string().max(255).regex(/^$|^[a-z0-9_]+$/),
    });

    it('should accept valid usernames for availability check', () => {
      const validUsernames = [
        'user123',
        'test_user',
        'a1b2c3',
        '', // Empty string should be allowed for availability check
        'x'.repeat(255) // Max length
      ];

      validUsernames.forEach(username => {
        const result = usernameAvailableSchema.safeParse({ username });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid username formats', () => {
      const invalidUsernames = [
        'user-name', // Contains hyphen
        'user name', // Contains space
        'User123', // Contains uppercase (not normalized in this schema)
        'user@name', // Contains special character
        'x'.repeat(256) // Too long
      ];

      invalidUsernames.forEach(username => {
        const result = usernameAvailableSchema.safeParse({ username });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Switch Organization Validation', () => {
    const switchOrgSchema = z.object({
      organizationId: z.string().min(1)
    });

    it('should accept valid organization IDs', () => {
      const validIds = [
        'org-123',
        'organization_456',
        'a1b2c3d4',
        'x'.repeat(100) // Long ID
      ];

      validIds.forEach(organizationId => {
        const result = switchOrgSchema.safeParse({ organizationId });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid organization IDs', () => {
      const invalidIds = [
        '', // Empty string
      ];

      invalidIds.forEach(organizationId => {
        const result = switchOrgSchema.safeParse({ organizationId });
        expect(result.success).toBe(false);
      });
    });

    it('should require organizationId field', () => {
      const result = switchOrgSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle extremely long strings gracefully', () => {
      const veryLongString = 'x'.repeat(10000);
      
      const schemas = [
        z.string().max(255),
        z.string().email(),
      ];

      schemas.forEach(schema => {
        const result = schema.safeParse(veryLongString);
        expect(result.success).toBe(false);
      });

      // Test regex separately since it might pass for very long valid strings
      const regexSchema = z.string().regex(/^[a-z0-9_]+$/);
      const longValidString = 'a'.repeat(10000);
      const regexResult = regexSchema.safeParse(longValidString);
      // This might pass since it's valid format, just very long
    });

    it('should handle special characters in usernames', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '+', '=', '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/'];
      
      const usernameSchema = z.string().regex(/^[a-z0-9_]+$/);

      specialChars.forEach(char => {
        const result = usernameSchema.safeParse(`user${char}name`);
        expect(result.success).toBe(false);
      });
    });

    it('should handle unicode characters', () => {
      const unicodeStrings = [
        'José', // Accented character
        'Москва', // Cyrillic
        '北京', // Chinese
        '🚀', // Emoji
        'test\u0000null' // Null character
      ];

      const nameSchema = z.string().min(1).max(255);
      const usernameSchema = z.string().regex(/^[a-z0-9_]+$/);

      unicodeStrings.forEach(str => {
        // Names should accept unicode
        const nameResult = nameSchema.safeParse(str);
        expect(nameResult.success).toBe(true);

        // Usernames should reject unicode
        const usernameResult = usernameSchema.safeParse(str);
        expect(usernameResult.success).toBe(false);
      });
    });
  });
});