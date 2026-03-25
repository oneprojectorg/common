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

        console.log('[VersionPreview] extracting fragments', {
          versionId,
          fragmentNames,
          payloadLength: data.payload.length,
        });

        for (const name of fragmentNames) {
          try {
            const content = getPreviewContentFromVersionPayload(
              data.payload,
              name,
            ) as JSONContent | null;

            console.log(`[VersionPreview] fragment "${name}"`, {
              hasContent: content !== null && content !== undefined,
              content: JSON.stringify(content)?.slice(0, 200),
            });

            contents[name] = content;
          } catch (err) {
            console.error(`[VersionPreview] fragment "${name}" error`, err);
            contents[name] = null;
          }
        }

        console.log(
          '[VersionPreview] final contents keys',
          Object.keys(contents),
        );
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

  return (
    <VersionPreviewContext.Provider value={value}>
      {children}
    </VersionPreviewContext.Provider>
  );
}

export function useOptionalVersionPreview(): VersionPreviewState | null {
  return useContext(VersionPreviewContext);
}
