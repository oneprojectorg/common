import { describe, expect, it } from 'vitest';

import { avatarImageLoader, getAvatarImageProps } from './getAvatarImageProps';

describe.concurrent('getAvatarImageProps', () => {
  it('returns no props when the avatar has no source', () => {
    expect(getAvatarImageProps(undefined)).toEqual({});
    expect(getAvatarImageProps(null)).toEqual({});
    expect(getAvatarImageProps('')).toEqual({});
  });

  it('serves square crops from Supabase at 1x and 2x', () => {
    const { src, srcSet } = getAvatarImageProps('/assets/a/avatar.png');

    expect(src).toBe(
      '/assets/a/avatar.png?width=256&height=256&resize=cover&quality=75',
    );
    expect(srcSet).toBe(
      '/assets/a/avatar.png?width=128&height=128&resize=cover&quality=75 1x, ' +
        '/assets/a/avatar.png?width=256&height=256&resize=cover&quality=75 2x',
    );
  });
});

describe.concurrent('avatarImageLoader', () => {
  it('passes sources outside the assets bucket through unchanged', () => {
    const src = 'https://example.com/avatar.png';

    expect(avatarImageLoader({ src, width: 128 })).toBe(src);
  });
});
