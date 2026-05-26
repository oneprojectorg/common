export const getExtension = (fileName: string | null): string | null => {
  if (!fileName) {
    return null;
  }
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) {
    return null;
  }
  return fileName.slice(dot + 1).toUpperCase();
};

export const stripExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

export const truncateName = (name: string, max = 50): string =>
  name.length <= max ? name : `${name.slice(0, max - 1)}…`;
