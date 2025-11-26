#!/usr/bin/env tsx
/**
 * Check if Centrifugo test instance is running and healthy
 * Usage: pnpm w:realtime test:check-centrifugo
 */

import { isCentrifugoHealthy, TEST_CONFIG } from './index';

async function main() {
  console.log(`🔍 Checking Centrifugo at ${TEST_CONFIG.CENTRIFUGO_URL}...`);

  const healthy = await isCentrifugoHealthy();

  if (healthy) {
    console.log('✅ Centrifugo is running and healthy');
    process.exit(0);
  } else {
    console.error('❌ Centrifugo is not running or not healthy');
    console.error('');
    console.error('To start Centrifugo for testing, run:');
    console.error('  pnpm w:realtime test:centrifugo:start');
    console.error('');
    console.error('To view logs:');
    console.error('  pnpm w:realtime test:centrifugo:logs');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
