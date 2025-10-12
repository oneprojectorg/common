interface CacheEntry {
  value: string;
  expiry: number;
}

const didCache = new Map<string, CacheEntry>();
const pdsCache = new Map<string, CacheEntry>();
const authServerCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedValue(
  cache: Map<string, CacheEntry>,
  key: string
): string | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue(
  cache: Map<string, CacheEntry>,
  key: string,
  value: string
): void {
  cache.set(key, {
    value,
    expiry: Date.now() + CACHE_TTL,
  });
}

export async function resolveHandleToDid(handle: string): Promise<string> {
  const normalizedHandle = handle.startsWith('@')
    ? handle.slice(1)
    : handle;

  const cached = getCachedValue(didCache, normalizedHandle);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://${normalizedHandle}/.well-known/atproto-did`,
      {
        headers: { Accept: 'text/plain' },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to resolve handle: ${response.statusText}`);
    }

    const did = await response.text();
    const trimmedDid = did.trim();

    if (!trimmedDid.startsWith('did:')) {
      throw new Error('Invalid DID format');
    }

    setCachedValue(didCache, normalizedHandle, trimmedDid);

    return trimmedDid;
  } catch (error) {
    throw new Error(
      `Handle not found or PDS unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function fetchPdsUrl(did: string): Promise<string> {
  const cached = getCachedValue(pdsCache, did);

  if (cached) {
    return cached;
  }

  try {
    const plcDirectoryUrl = 'https://plc.directory';
    const response = await fetch(`${plcDirectoryUrl}/${did}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch DID document: ${response.statusText}`);
    }

    const didDocument = await response.json();

    if (!didDocument.service || !Array.isArray(didDocument.service)) {
      throw new Error('No services found in DID document');
    }

    const pdsService = didDocument.service.find(
      (s: any) => s.type === 'AtprotoPersonalDataServer'
    );

    if (!pdsService || !pdsService.serviceEndpoint) {
      throw new Error('No PDS service found in DID document');
    }

    const pdsUrl = pdsService.serviceEndpoint;
    setCachedValue(pdsCache, did, pdsUrl);

    return pdsUrl;
  } catch (error) {
    throw new Error(
      `Failed to fetch PDS URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getAuthorizationServerUrl(
  pdsUrl: string
): Promise<string> {
  const cached = getCachedValue(authServerCache, pdsUrl);

  if (cached) {
    return cached;
  }

  try {
    const wellKnownUrl = `${pdsUrl}/.well-known/oauth-protected-resource`;
    const response = await fetch(wellKnownUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch authorization server metadata: ${response.statusText}`
      );
    }

    const metadata = await response.json();

    if (!metadata.authorization_servers || !metadata.authorization_servers[0]) {
      throw new Error('No authorization server found in metadata');
    }

    const authServerUrl = metadata.authorization_servers[0];
    setCachedValue(authServerCache, pdsUrl, authServerUrl);

    return authServerUrl;
  } catch (error) {
    throw new Error(
      `Failed to get authorization server URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
