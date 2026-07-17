/**
 * The onboarding form persists to sessionStorage under the `onboarding-form`
 * key. The image uploaders briefly hold a base64 `data:` URL for the preview,
 * and two of those blobs overflow the ~5MB quota — the write throws
 * QuotaExceededError and breaks onboarding. These tests pin the two guards:
 * base64 blobs are never persisted, and a failing write degrades gracefully.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/logging/client', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

class MockStorage {
  private store = new Map<string, string>();
  setItem = vi.fn((name: string, value: string) => {
    this.store.set(name, value);
  });
  getItem = (name: string) => this.store.get(name) ?? null;
  removeItem = (name: string) => {
    this.store.delete(name);
  };
}

const importStore = async () => {
  const mod = await import('./useOnboardingFormStore');
  return mod.useOnboardingFormStore;
};

const persistedState = (storage: MockStorage) => {
  const raw = storage.getItem('onboarding-form');
  if (!raw) {
    throw new Error('nothing was persisted');
  }
  return JSON.parse(raw).state;
};

let storage: MockStorage;

beforeEach(() => {
  vi.resetModules();
  storage = new MockStorage();
  vi.stubGlobal('sessionStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOnboardingFormStore persistence', () => {
  it('does not persist base64 data URL image blobs', async () => {
    const useStore = await importStore();

    useStore.getState().setPersonalDetails({
      fullName: 'Ada Lovelace',
      profileImageUrl: 'data:image/png;base64,AAAAveryLargeBlob==',
      bannerImageUrl: 'https://cdn.example.com/banner.png',
    });

    const { personalDetails } = persistedState(storage);
    expect(personalDetails.fullName).toBe('Ada Lovelace');
    expect(personalDetails.profileImageUrl).toBeUndefined();
    // A real uploaded URL is small and must survive so a refresh keeps it.
    expect(personalDetails.bannerImageUrl).toBe(
      'https://cdn.example.com/banner.png',
    );
  });

  it('strips nested base64 blobs from other form slices', async () => {
    const useStore = await importStore();

    useStore.getState().setOrganizationDetails({
      name: 'One Project',
      profileImage: { url: 'data:image/jpeg;base64,BBBBblob==' },
      bannerImage: { url: 'https://cdn.example.com/org.png' },
    });

    const { organizationDetails } = persistedState(storage);
    expect(organizationDetails.name).toBe('One Project');
    expect(organizationDetails.profileImage.url).toBeUndefined();
    expect(organizationDetails.bannerImage.url).toBe(
      'https://cdn.example.com/org.png',
    );
  });

  it('degrades gracefully when the write exceeds the quota', async () => {
    storage.setItem.mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    const useStore = await importStore();

    expect(() =>
      useStore.getState().setPersonalDetails({ fullName: 'Grace Hopper' }),
    ).not.toThrow();
    expect(useStore.getState().personalDetails).toEqual({
      fullName: 'Grace Hopper',
    });
  });
});
