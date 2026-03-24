'use client';

import { getPreviewContentFromVersionPayload } from '@tiptap-pro/extension-snapshot';
import type { THistoryVersion } from '@tiptap-pro/provider';
import type { JSONContent } from '@tiptap/react';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useCollaborativeDoc } from '../../collaboration';

interface VersionPreviewState {
  tiptapVersion: THistoryVersion | null;
  fragmentContents: Record<string, JSONContent | null>;
}

const VersionPreviewContext = createContext<VersionPreviewState | null>(null);

/**
 * Extracts preview content for a fragment and normalizes it to a full TipTap
 * document so the readonly viewer can render snapshot payloads consistently.
 */
function getNormalizedPreviewContent(
  payload: string,
  fragmentName: string,
): JSONContent | null {
  const content = getPreviewContentFromVersionPayload(payload, fragmentName);

  if (!content || typeof content !== 'object') {
    return null;
  }

  if (Array.isArray(content)) {
    const normalized: JSONContent = {
      type: 'doc',
      content: content as JSONContent[],
    };

    return normalized;
  }

  const candidate = content as JSONContent;

  if (candidate.type === 'doc') {
    return candidate;
  }

  if (candidate.type) {
    const normalized: JSONContent = {
      type: 'doc',
      content: [candidate],
    };

    return normalized;
  }

  if (Array.isArray(candidate.content)) {
    const normalized: JSONContent = {
      type: 'doc',
      content: candidate.content,
    };

    return normalized;
  }

  return null;
}

/**
 * Resolves preview content for a selected TipTap document version.
 * The selected version comes from the URL state, so deep links can open a
 * specific version directly when the versions aside is visible.
 */
export function VersionPreviewProvider({
  versionId,
  fragmentNames,
  children,
}: {
  versionId: number | null;
  fragmentNames: string[];
  children: ReactNode;
}) {
  const { provider } = useCollaborativeDoc();
  const [versions, setVersions] = useState<THistoryVersion[]>([]);
  const [fragmentContents, setFragmentContents] = useState<
    Record<string, JSONContent | null>
  >({});

  useEffect(() => {
    const readVersions = () => [...provider.getVersions()];

    setVersions(readVersions());

    const handleVersionsUpdate = () => {
      setVersions(readVersions());
    };

    provider.watchVersions(handleVersionsUpdate);

    return () => {
      provider.unwatchVersions(handleVersionsUpdate);
    };
  }, [provider]);

  const tiptapVersion = useMemo(
    () =>
      versionId === null
        ? null
        : (versions.find((item) => item.version === versionId) ?? null),
    [versionId, versions],
  );

  useEffect(() => {
    if (versionId === null) {
      setFragmentContents({});
      return;
    }

    console.log('[VersionPreview] requesting preview for version:', versionId);
    provider.previewVersion(versionId);
  }, [provider, versionId]);

  useEffect(() => {
    const onStateless = (data: { payload: string }) => {
      try {
        const parsed = JSON.parse(data.payload) as {
          event?: string;
          version?: number;
        };

        console.log('[VersionPreview] stateless event:', {
          event: parsed.event,
          version: parsed.version,
          expectedVersion: versionId,
        });

        if (
          parsed.event !== 'version.preview' ||
          parsed.version !== versionId
        ) {
          return;
        }

        const contents: Record<string, JSONContent | null> = {};

        console.log('[VersionPreview] fragmentNames:', fragmentNames);

        for (const name of fragmentNames) {
          try {
            contents[name] = getNormalizedPreviewContent(data.payload, name);
          } catch {
            console.warn(`[VersionPreview] failed to parse fragment "${name}"`);
            contents[name] = null;
          }
        }
        setFragmentContents(contents);
      } catch {
        // Ignore unrelated stateless provider events.
      }
    };

    provider.on('stateless', onStateless);
    return () => {
      provider.off('stateless', onStateless);
    };
  }, [fragmentNames, provider, versionId]);

  const value = useMemo(
    () =>
      tiptapVersion
        ? {
            tiptapVersion,
            fragmentContents,
          }
        : null,
    [fragmentContents, tiptapVersion],
  );

  console.log('[VersionPreview] context value:', {
    versionId,
    tiptapVersion: tiptapVersion?.version ?? null,
    fragmentKeys: Object.keys(fragmentContents),
    fragmentContents,
  });

  return (
    <VersionPreviewContext.Provider value={value}>
      {children}
    </VersionPreviewContext.Provider>
  );
}

export function useOptionalVersionPreview(): VersionPreviewState | null {
  return useContext(VersionPreviewContext);
}
