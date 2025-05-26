import { CommonError } from './error';

export const decodeCursor = (cursor: string) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    throw new CommonError('Invalid cursor');
  }
};

export const encodeCursor = (updatedAt: Date, id: string) => {
  return Buffer.from(JSON.stringify({ updatedAt, id })).toString('base64');
};
