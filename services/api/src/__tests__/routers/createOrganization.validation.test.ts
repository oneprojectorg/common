import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createOrganizationInputSchema } from '../../routers/organization/validators';

describe('createOrganization Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganizationInputSchema', () => {
    it('should accept valid minimal input', () => {
      const validInput = {
        website: 'https://example.org',
        orgType: 'nonprofit',
        bio: 'A valid organization bio'
      };

      const result = createOrganizationInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject(validInput);
      }
    });

    it('should accept complete valid input', () => {
      const validCompleteInput = {
        name: 'Complete Test Organization',
        website: 'https://complete.org',
        email: 'contact@complete.org',
        orgType: 'nonprofit',
        bio: 'A complete organization with all fields',
        mission: 'To test all validation scenarios',
        networkOrganization: true,
        isReceivingFunds: true,
        isOfferingFunds: false,
        acceptingApplications: true,
        receivingFundsDescription: 'We accept grants for education',
        receivingFundsLink: 'https://complete.org/grants',
        offeringFundsDescription: '',
        offeringFundsLink: '',
        orgAvatarImageId: 'avatar-123',
        orgBannerImageId: 'banner-456'
      };

      const result = createOrganizationInputSchema.safeParse(validCompleteInput);
      if (!result.success) {
        console.log('Validation errors:', result.error.issues);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject(validCompleteInput);
      }
    });

    describe('name validation', () => {
      it('should accept valid names', () => {
        const inputs = [
          'Valid Organization',
          'A',
          'X'.repeat(200) // Max length
        ];

        inputs.forEach(name => {
          const input = {
            name,
            website: 'https://example.org',
            orgType: 'nonprofit',
            bio: 'Valid bio'
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should reject names that are too long', () => {
        const input = {
          name: 'X'.repeat(201), // Over max length
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['name'],
              message: 'String must contain at most 200 character(s)'
            })
          );
        }
      });

      it('should accept undefined name (optional)', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('website validation', () => {
      it('should accept valid websites', () => {
        const websites = [
          'https://example.org',
          'http://test.com',
          'https://very-long-domain-name.organization',
          'a' // Minimum length
        ];

        websites.forEach(website => {
          const input = {
            website,
            orgType: 'nonprofit',
            bio: 'Valid bio'
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should reject empty website', () => {
        const input = {
          website: '',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['website'],
              message: 'enter a '
            })
          );
        }
      });

      it('should reject websites that are too long', () => {
        const input = {
          website: 'https://' + 'x'.repeat(200) + '.com',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['website'],
              message: 'String must contain at most 200 character(s)'
            })
          );
        }
      });

      it('should require website field', () => {
        const input = {
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['website']
            })
          );
        }
      });
    });

    describe('email validation', () => {
      it('should accept valid emails', () => {
        const emails = [
          'test@example.com',
          'user+tag@domain.org',
          'a@b.co'
        ];

        emails.forEach(email => {
          const input = {
            email,
            website: 'https://example.org',
            orgType: 'nonprofit',
            bio: 'Valid bio'
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid emails', () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user@domain',
          ''
        ];

        invalidEmails.forEach(email => {
          const input = {
            email,
            website: 'https://example.org',
            orgType: 'nonprofit',
            bio: 'Valid bio'
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues).toContainEqual(
              expect.objectContaining({
                path: ['email'],
                message: 'Invalid email'
              })
            );
          }
        });
      });

      it('should reject emails that are too long', () => {
        const longEmail = 'x'.repeat(195) + '@test.com'; // This will be over 200 chars
        const input = {
          email: longEmail,
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['email'],
              message: 'String must contain at most 200 character(s)'
            })
          );
        }
      });

      it('should accept undefined email (optional)', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('orgType validation', () => {
      it('should accept valid org types', () => {
        const orgTypes = [
          'nonprofit',
          'foundation',
          'social-enterprise',
          'government',
          'academic',
          'other'
        ];

        orgTypes.forEach(orgType => {
          const input = {
            website: 'https://example.org',
            orgType,
            bio: 'Valid bio'
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should reject org types that are too long', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'x'.repeat(201),
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['orgType'],
              message: 'String must contain at most 20 character(s)'
            })
          );
        }
      });

      it('should require orgType field', () => {
        const input = {
          website: 'https://example.org',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['orgType']
            })
          );
        }
      });
    });

    describe('bio validation', () => {
      it('should accept valid bios', () => {
        const bios = [
          'Short bio',
          'x'.repeat(1500), // Max length
          ''
        ];

        bios.forEach(bio => {
          const input = {
            website: 'https://example.org',
            orgType: 'nonprofit',
            bio
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should reject bios that are too long', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'x'.repeat(1501)
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['bio'],
              message: 'String must contain at most 1500 character(s)'
            })
          );
        }
      });

      it('should require bio field', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['bio']
            })
          );
        }
      });
    });

    describe('mission validation', () => {
      it('should accept valid missions', () => {
        const missions = [
          'Our mission is to help',
          'x'.repeat(1500), // Max length
          ''
        ];

        missions.forEach(mission => {
          const input = {
            website: 'https://example.org',
            orgType: 'nonprofit',
            bio: 'Valid bio',
            mission
          };
          const result = createOrganizationInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should reject missions that are too long', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          mission: 'x'.repeat(1501)
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['mission'],
              message: 'String must contain at most 1500 character(s)'
            })
          );
        }
      });

      it('should accept undefined mission (optional)', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('boolean fields validation', () => {
      it('should accept valid boolean values', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          networkOrganization: true,
          isReceivingFunds: false,
          isOfferingFunds: true,
          acceptingApplications: false
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.networkOrganization).toBe(true);
          expect(result.data.isReceivingFunds).toBe(false);
          expect(result.data.isOfferingFunds).toBe(true);
          expect(result.data.acceptingApplications).toBe(false);
        }
      });

      it('should apply default values for optional boolean fields', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.networkOrganization).toBe(false);
        }
      });
    });

    describe('array fields validation', () => {
      it('should accept valid arrays', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          focusAreas: [
            { id: 'education', label: 'Education', isNewValue: false },
            { id: 'healthcare', label: 'Healthcare', isNewValue: true }
          ],
          strategies: [
            { id: 'direct', label: 'Direct Service', isNewValue: false }
          ]
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.focusAreas).toHaveLength(2);
          expect(result.data.strategies).toHaveLength(1);
        }
      });

      it('should accept empty arrays', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          focusAreas: [],
          strategies: []
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept undefined arrays (optional)', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio'
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should validate multiSelectOption structure', () => {
        const invalidInput = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          focusAreas: [
            { id: 'education' } // Missing label
          ]
        };

        const result = createOrganizationInputSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['focusAreas', 0, 'label']
            })
          );
        }
      });

      it('should validate label length in multiSelectOptions', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          focusAreas: [
            { id: 'education', label: 'x'.repeat(201), isNewValue: false }
          ]
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toContainEqual(
            expect.objectContaining({
              path: ['focusAreas', 0, 'label'],
              message: 'String must contain at most 200 character(s)'
            })
          );
        }
      });
    });

    describe('whereWeWork validation', () => {
      it('should accept empty whereWeWork array', () => {
        const input = {
          website: 'https://example.org',
          orgType: 'nonprofit',
          bio: 'Valid bio',
          whereWeWork: []
        };

        const result = createOrganizationInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });
});