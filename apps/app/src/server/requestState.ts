import { getRequest } from '@tanstack/react-start/server';

/**
 * Per-request facts the request middleware records for code that runs later
 * in the same request, keyed on the request object itself.
 */
const cspNonces = new WeakMap<Request, string>();
const forbiddenRequests = new WeakSet<Request>();

export const setRequestCspNonce = (request: Request, nonce: string) => {
  cspNonces.set(request, nonce);
};

/** The nonce this request's Content-Security-Policy allows scripts with. */
export const getRequestCspNonce = () => cspNonces.get(getRequest());

/** Records that the current request rendered the no-access screen. */
export const markRequestForbidden = () => {
  forbiddenRequests.add(getRequest());
};

export const isRequestForbidden = (request: Request) =>
  forbiddenRequests.has(request);
