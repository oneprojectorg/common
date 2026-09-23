import { assetPublicUrl } from '@op/common/client';

export const getPublicUrl = (key?: string | null) => {
  if (!key) {
    return;
  }

  return assetPublicUrl(key);
};

export const makeArray = (item: any) => {
  if (item == null) {
    return [];
  }

  if (Array.isArray(item)) {
    return item;
  }

  return [item];
};
