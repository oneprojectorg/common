// This file is server-only to prevent the database from being imported in client components
// and to prevent the database URL from being exposed to the client.
import '@tanstack/react-start/server-only';

export { db } from './index';
export * from 'drizzle-orm';
export * from './types';
