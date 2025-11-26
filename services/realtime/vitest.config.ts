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
    'process.env.CENTRIFUGO_URL': '"http://127.0.0.1:8000"',
    'process.env.CENTRIFUGO_WS_URL': '"ws://127.0.0.1:8000/connection/websocket"',
    'process.env.CENTRIFUGO_TOKEN_SECRET':
      '"test-centrifugo-secret-key-for-local-dev"',
    'process.env.CENTRIFUGO_API_KEY': '"test-api-key"',
  },
});
