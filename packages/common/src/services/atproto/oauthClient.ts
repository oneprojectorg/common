import { randomBytes } from 'crypto';

export interface OAuthClientConfig {
  clientId: string;
  clientName: string;
  redirectUri: string;
}

export interface AuthorizationUrlParams {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  handle: string;
  authorizationServerUrl: string;
}

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generatePKCE() {
  const verifier = base64URLEncode(randomBytes(32));

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64URLEncode(Buffer.from(hashBuffer));

  return { codeVerifier: verifier, codeChallenge: challenge };
}

export async function generateAuthorizationUrl(
  params: Omit<AuthorizationUrlParams, 'codeVerifier' | 'codeChallenge'> & {
    clientId: string;
    redirectUri: string;
  }
): Promise<{ authorizationUrl: string; codeVerifier: string }> {
  const { codeVerifier, codeChallenge } = await generatePKCE();

  const authUrl = new URL(`${params.authorizationServerUrl}/oauth/authorize`);
  authUrl.searchParams.set('client_id', params.clientId);
  authUrl.searchParams.set('redirect_uri', params.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'atproto');
  authUrl.searchParams.set('state', params.state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    authorizationUrl: authUrl.toString(),
    codeVerifier,
  };
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  tokenEndpoint: string;
  clientId: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}> {
  const response = await fetch(params.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Token exchange failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

export async function fetchUserProfile(params: {
  accessToken: string;
  pdsUrl: string;
}): Promise<{
  did: string;
  handle: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}> {
  const response = await fetch(`${params.pdsUrl}/xrpc/com.atproto.server.getSession`, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch user profile: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return {
    did: data.did,
    handle: data.handle,
    email: data.email,
    displayName: data.displayName,
    avatar: data.avatar,
    description: data.description,
  };
}
