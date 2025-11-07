export const getPublicUrl = (key?: string | null) => {
  if (!key) {
    return;
  }

  return `/assets/${key}`;
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
