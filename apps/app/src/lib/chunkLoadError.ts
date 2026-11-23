// Webpack names the error ChunkLoadError ("Loading chunk 123 failed"); the
// Turbopack runtime words it "Failed to load chunk".
const CHUNK_LOAD_MESSAGE =
  /Loading (CSS )?chunk \S+ failed|Failed to load chunk/i;

/**
 * True when a dynamic `import()` failed because its chunk did not load: a
 * timeout, a network error, or a chunk a newer deploy removed.
 */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'ChunkLoadError' || CHUNK_LOAD_MESSAGE.test(error.message));
