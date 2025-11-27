import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.CENTRIFUGO_API_URL':
      '"https://realtime-production-zsndc.ondigitalocean.app/api"',
    'process.env.CENTRIFUGO_API_KEY':
      '"c0wd5CQ8qy-7wmoehh_2Yda2-C7OqMno40cHbGxkxkkJDFd0ihj9rre0U66pMEDxJ889SuqIjIxXzm1ckLlcMQ"',
    'process.env.CENTRIFUGO_TOKEN_SECRET':
      '"V4BevNH0PsJ4GvFloR3mp0A2QO-opTwwNxW0cD4FeuNtiWoWVWFnWkY-sg_eWpFJrb4vqL2NTnXEDPJ-smDwkg"',
  },
});
