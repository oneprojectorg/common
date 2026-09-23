import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: vi.fn(),
}));

import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils/error';
import { parsePhoneNumber } from '../notification/schemas';
import { createAccountFromPhone } from './createAccountFromPhone';

const PHONE = parsePhoneNumber('+15005550006');

const fakeSupabase = (createUser: ReturnType<typeof vi.fn>) => ({
  auth: { admin: { createUser } },
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createAccountFromPhone', () => {
  it('creates a phone-confirmed user and returns its id', async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase(createUser) as never,
    );

    const result = await createAccountFromPhone({ phone: PHONE });

    expect(createUser).toHaveBeenCalledWith({
      phone: PHONE,
      phone_confirm: true,
    });
    expect(result).toEqual({ authUserId: 'auth-user-1' });
  });

  it('throws when Supabase reports an error', async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'phone number already registered' },
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase(createUser) as never,
    );

    await expect(createAccountFromPhone({ phone: PHONE })).rejects.toThrow(
      CommonError,
    );
  });

  it('throws when Supabase reports no error but no user either', async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase(createUser) as never,
    );

    await expect(createAccountFromPhone({ phone: PHONE })).rejects.toThrow(
      CommonError,
    );
  });
});
