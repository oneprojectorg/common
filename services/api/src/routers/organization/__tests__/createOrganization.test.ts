import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TContext, TContextWithUser, TContextWithLogger } from '../../../types';

// Mock the common package completely
vi.mock('@op/common', () => ({
  createOrganization: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  },
}));

// Mock the encoder
vi.mock('../../../encoders/organizations', () => ({
  organizationsEncoder: {
    parse: vi.fn((data) => data),
  },
}));

import { createOrganization } from '@op/common';
import { createOrganizationRouter } from '../createOrganization';

describe('createOrganization router', () => {
  const mockCreateOrganization = vi.mocked(createOrganization);

  const mockContext = {
    getCookies: vi.fn(() => ({})),
    getCookie: vi.fn(),
    setCookie: vi.fn(),
    requestId: 'req-123',
    time: Date.now(),
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    logger: {
      info: vi.fn(),
    },
  } as unknown as TContext & TContextWithUser & TContextWithLogger;

  const validInput = {
    name: 'Test Organization',
    website: 'https://example.com',
    email: 'contact@example.com',
    orgType: 'nonprofit',
    bio: 'A test organization for API testing',
    mission: 'To test the organization creation functionality',
    networkOrganization: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully create an organization with valid input', async () => {
    const mockOrganization = {
      id: 'org-123',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      deletedAt: null,
      profileId: 'profile-123',
      domain: null,
      isVerified: false,
      networkOrganization: false,
      isOfferingFunds: false,
      isReceivingFunds: false,
      acceptingApplications: false,
      orgType: 'nonprofit',
      profile: {
        id: 'profile-123',
        name: 'Test Organization',
        search: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        deletedAt: null,
        address: null,
        type: 'organization',
        slug: 'test-organization',
        bio: 'A test organization for API testing',
        mission: 'To test the organization creation functionality',
        email: 'contact@example.com',
        phone: null,
        website: 'https://example.com',
        city: null,
        state: null,
        postalCode: null,
        bannerImageId: null,
        avatarImageId: null,
      },
    };

    mockCreateOrganization.mockResolvedValueOnce(mockOrganization);

    const result = await createOrganizationRouter
      .createCaller(mockContext)
      .create(validInput);

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      data: validInput,
      user: mockContext.user,
    });
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Organization created',
      {
        userId: mockContext.user.id,
        organizationId: mockOrganization.id,
        organizationName: mockOrganization.profile.name,
      }
    );
    expect(result).toEqual(mockOrganization);
  });

  it('should throw UNAUTHORIZED error when user lacks permission', async () => {
    const unauthorizedError = new UnauthorizedError('Permission denied');
    mockCreateOrganization.mockRejectedValueOnce(unauthorizedError);

    await expect(
      createOrganizationRouter.createCaller(mockContext).create(validInput)
    ).rejects.toThrow(
      new TRPCError({
        message: 'You do not have permission to create organizations',
        code: 'UNAUTHORIZED',
      })
    );

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      data: validInput,
      user: mockContext.user,
    });
  });

  it('should throw INTERNAL_SERVER_ERROR for unexpected errors', async () => {
    const unexpectedError = new Error('Database connection failed');
    mockCreateOrganization.mockRejectedValueOnce(unexpectedError);

    await expect(
      createOrganizationRouter.createCaller(mockContext).create(validInput)
    ).rejects.toThrow(
      new TRPCError({
        message: 'Failed to create organization',
        code: 'INTERNAL_SERVER_ERROR',
      })
    );

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      data: validInput,
      user: mockContext.user,
    });
  });

  it('should handle minimal required input', async () => {
    const minimalInput = {
      website: 'https://minimal.com',
      orgType: 'other',
      bio: 'Minimal test org',
      networkOrganization: false,
    };

    const mockOrganization = {
      id: 'org-456',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      deletedAt: null,
      profileId: 'profile-456',
      domain: null,
      isVerified: false,
      networkOrganization: false,
      isOfferingFunds: false,
      isReceivingFunds: false,
      acceptingApplications: false,
      orgType: 'other',
      profile: {
        id: 'profile-456',
        name: 'Minimal Org',
        search: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        deletedAt: null,
        address: null,
        type: 'organization',
        slug: 'minimal-org',
        bio: 'Minimal test org',
        mission: null,
        email: null,
        phone: null,
        website: 'https://minimal.com',
        city: null,
        state: null,
        postalCode: null,
        bannerImageId: null,
        avatarImageId: null,
      },
    };

    mockCreateOrganization.mockResolvedValueOnce(mockOrganization);

    const result = await createOrganizationRouter
      .createCaller(mockContext)
      .create(minimalInput);

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      data: minimalInput,
      user: mockContext.user,
    });
    expect(result).toEqual(mockOrganization);
  });

  it('should handle input with optional arrays', async () => {
    const inputWithArrays = {
      ...validInput,
      focusAreas: [
        { id: '1', label: 'Education', isNewValue: false },
        { id: '2', label: 'Healthcare', isNewValue: true },
      ],
      whereWeWork: [
        {
          id: '1',
          label: 'New York',
          isNewValue: false,
          data: {
            name: 'New York',
            placeId: 'place-123',
            countryCode: 'US',
            countryName: 'United States',
            id: 'loc-123',
            metadata: { city: 'New York', state: 'NY' },
          },
        },
      ],
      strategies: [
        { id: '1', label: 'Direct Service', isNewValue: false },
      ],
    };

    const mockOrganization = {
      id: 'org-789',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      deletedAt: null,
      profileId: 'profile-789',
      domain: null,
      isVerified: false,
      networkOrganization: false,
      isOfferingFunds: false,
      isReceivingFunds: false,
      acceptingApplications: false,
      orgType: 'nonprofit',
      profile: {
        id: 'profile-789',
        name: 'Complex Organization',
        search: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        deletedAt: null,
        address: null,
        type: 'organization',
        slug: 'complex-organization',
        bio: 'A test organization for API testing',
        mission: 'To test the organization creation functionality',
        email: 'contact@complex.com',
        phone: null,
        website: 'https://example.com',
        city: null,
        state: null,
        postalCode: null,
        bannerImageId: null,
        avatarImageId: null,
      },
    };

    mockCreateOrganization.mockResolvedValueOnce(mockOrganization);

    const result = await createOrganizationRouter
      .createCaller(mockContext)
      .create(inputWithArrays);

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      data: inputWithArrays,
      user: mockContext.user,
    });
    expect(result).toEqual(mockOrganization);
  });
});
