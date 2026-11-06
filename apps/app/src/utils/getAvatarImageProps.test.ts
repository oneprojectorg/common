import { describe, expect, it } from 'vitest';

import { getAvatarImageProps } from './getAvatarImageProps';

describe.concurrent('getAvatarImageProps', () => {
  it('returns no props when the avatar has no source', () => {
    expect(getAvatarImageProps(undefined)).toEqual({});
    expect(getAvatarImageProps(null)).toEqual({});
    expect(getAvatarImageProps('')).toEqual({});
  });

  it('serves the avatar through the image optimizer at 1x and 2x', () => {
    const { src, srcSet } = getAvatarImageProps('/assets/avatar.png');

    expect(src).toMatch(/^\/_next\/image\?url=%2Fassets%2Favatar\.png&w=256/);
    expect(srcSet).toMatch(/w=128&q=\d+ 1x, .*w=256&q=\d+ 2x$/);
  });
});
