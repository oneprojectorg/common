export * from './error';
export * from './db';
export * from './storage';
export * from './validation';
export * from './email';
export * from './pagination';

export const filterNullOrUndefined = (data: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined),
  );
