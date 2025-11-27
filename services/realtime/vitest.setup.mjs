import { config } from 'dotenv';
import { execSync } from 'node:child_process';

// Load .env.test file for test environment variables
config({ path: '.env.test' });

const CONTAINER_NAME = 'centrifugo';
const PORT = '8000';

// Track whether we started the container (so we know whether to stop it)
let startedByUs = false;

function isContainerRunning(containerName) {
  try {
    const result = execSync(
      `docker inspect -f '{{.State.Running}}' ${containerName}`,
      { stdio: 'pipe', encoding: 'utf-8' },
    );
    return result.trim() === 'true';
  } catch {
    return false;
  }
}

export async function setup() {
  console.log('🔍 Checking for existing Centrifugo container...');

  try {
    if (isContainerRunning(CONTAINER_NAME)) {
      console.log(
        '✅ Centrifugo container is already running (using existing)',
      );
      startedByUs = false;
      return;
    }

    // Container not running, start it
    console.log('🚀 Starting Centrifugo container...');

    // Remove any stopped container with same name
    try {
      execSync(`docker rm ${CONTAINER_NAME}`, { stdio: 'pipe' });
    } catch {
      // Container doesn't exist, which is fine
    }

    // Start Centrifugo container with env-based configuration
    execSync(
      `docker run -d --rm --name ${CONTAINER_NAME} -p ${PORT}:8000 --env-file .env.test centrifugo/centrifugo:v6 centrifugo`,
      { stdio: 'inherit' },
    );

    startedByUs = true;

    // Wait for Centrifugo to be ready
    console.log('⏳ Waiting for Centrifugo to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('✅ Centrifugo container is ready');
  } catch (error) {
    console.error('❌ Failed to start Centrifugo container:', error);
    throw error;
  }
}

export async function teardown() {
  // Only stop the container if we started it
  if (!startedByUs) {
    console.log(
      'ℹ️  Leaving Centrifugo container running (was already running before tests)',
    );
    return;
  }

  console.log('🧹 Stopping Centrifugo container...');

  try {
    execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'pipe' });
    console.log('✅ Centrifugo container stopped');
  } catch (error) {
    console.error('❌ Failed to stop Centrifugo container:', error);
    // Don't throw here as we want tests to complete even if cleanup fails
  }
}
