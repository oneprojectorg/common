'use client';

import { getPreviewContentFromVersionPayload } from '@tiptap-pro/extension-snapshot';
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
  previewVersion: number | null;
  fragmentContents: Record<string, JSONContent | null>;
}

const VersionPreviewContext = createContext<VersionPreviewState | null>(null);

/**
 * Resolves preview content for a selected TipTap document version.
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
  const [fragmentContents, setFragmentContents] = useState<
    Record<string, JSONContent | null>
  >({});

  useEffect(() => {
    if (versionId === null) {
      setFragmentContents({});
      return;
    }

    provider.previewVersion(versionId);
  }, [provider, versionId]);

  useEffect(() => {
    const onStateless = (data: { payload: string }) => {
      try {
        const parsed = JSON.parse(data.payload) as {
          event?: string;
          version?: number;
        };

        if (
          parsed.event !== 'version.preview' ||
          parsed.version !== versionId
        ) {
          return;
        }

        const contents: Record<string, JSONContent | null> = {};

        for (const name of fragmentNames) {
          try {
            contents[name] = getPreviewContentFromVersionPayload(
              data.payload,
              name,
            ) as JSONContent | null;
          } catch {
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

  const value = useMemo<VersionPreviewState | null>(
    () =>
      versionId === null
        ? null
        : {
            previewVersion: versionId,
            fragmentContents,
          },
    [fragmentContents, versionId],
  );

  return (
    <VersionPreviewContext.Provider value={value}>
      {children}
    </VersionPreviewContext.Provider>
  );
}

export function useOptionalVersionPreview(): VersionPreviewState | null {
  return useContext(VersionPreviewContext);
}
