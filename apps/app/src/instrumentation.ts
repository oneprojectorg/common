import { registerObservability } from '@op/logging/instrumentation';

export function register() {
  registerObservability({ defaultServiceName: 'common' });
}

export { onRequestError } from '@op/logging/instrumentation';
