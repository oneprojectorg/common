export const firstHeaderValue = (
  header: string | null | undefined,
): string | null => {
  const value = header?.split(',')[0]?.trim();
  return value ? value : null;
};
