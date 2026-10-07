import type { PhoneVerifyResult } from './types';

const EXPIRED_CODE = 'otp_expired';

export interface VerifyOtpAnswer {
  data: { session?: unknown } | null;
  error: { code?: string; message?: string; status?: number } | null;
}

export const toVerifyResult = ({
  data,
  error,
}: VerifyOtpAnswer): PhoneVerifyResult => {
  if (data?.session) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: error?.code === EXPIRED_CODE ? 'expired' : 'wrong_code',
  };
};
