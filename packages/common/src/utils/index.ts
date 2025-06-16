export * from './error';
export * from './db';

export const filterNullOrUndefined = (data: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined),
  );
