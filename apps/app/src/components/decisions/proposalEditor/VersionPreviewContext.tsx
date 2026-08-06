'use client';

import { logger } from '@op/logging/client';
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
    // Clear on every change, not just on null: the incoming version's contents
    // arrive asynchronously, and restoring while the previous version's are
    // still held would revert the body to one version and write another's
    // title, category and budget.
    setFragmentContents({});

    if (versionId === null) {
      return;
    }

    provider.previewVersion(versionId);
  }, [provider, versionId]);

  useEffect(() => {
    const onStateless = (data: { payload: string }) => {
      let parsed: { event?: string; version?: number };

      try {
        parsed = JSON.parse(data.payload) as typeof parsed;
      } catch {
        // Not JSON — an unrelated stateless provider event.
        return;
      }

      if (parsed.event !== 'version.preview' || parsed.version !== versionId) {
        return;
      }

      const contents: Record<string, JSONContent | null> = {};

      for (const name of fragmentNames) {
        try {
          contents[name] = getNormalizedPreviewContent(data.payload, name);
        } catch (error) {
          // Publish nothing rather than a partial preview: a null fragment is
          // indistinguishable from an empty one downstream, and `restoreVersion`
          // would write it as a blank title.
          logger.error('[VersionPreview] failed to parse fragment', {
            error,
            fragmentName: name,
            versionId,
          });
          setFragmentContents({});
          return;
        }
      }

      setFragmentContents(contents);
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
