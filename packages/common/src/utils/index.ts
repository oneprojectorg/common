export * from './error';
export * from './db';
export * from './validation';

export const filterNullOrUndefined = (data: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined),
  );
