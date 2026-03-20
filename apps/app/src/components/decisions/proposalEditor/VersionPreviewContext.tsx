'use client';

import { getPreviewContentFromVersionPayload } from '@tiptap-pro/extension-snapshot';
import type { JSONContent } from '@tiptap/react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useCollaborativeDoc } from '../../collaboration';

interface VersionPreviewState {
  /** The version number currently being previewed, or null if not previewing. */
  previewVersion: number | null;
  /** Per-fragment preview contents keyed by fragment name. */
  fragmentContents: Record<string, JSONContent | null>;
  /** Start previewing a version. */
  startPreview: (version: number) => void;
  /** Exit preview mode without reverting. */
  exitPreview: () => void;
}

const VersionPreviewContext = createContext<VersionPreviewState | null>(null);

/**
 * Provides version preview state to the editor layout.
 * Listens for TipTap `version.preview` stateless events and parses
 * the snapshot Y.doc into TipTap JSON per fragment.
 */
export function VersionPreviewProvider({
  fragmentNames,
  children,
}: {
  fragmentNames: string[];
  children: ReactNode;
}) {
  const { provider } = useCollaborativeDoc();
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [fragmentContents, setFragmentContents] = useState<
    Record<string, JSONContent | null>
  >({});

  const startPreview = useCallback(
    (version: number) => {
      setPreviewVersion(version);
      setFragmentContents({});
      provider.previewVersion(version);
    },
    [provider],
  );

  const exitPreview = useCallback(() => {
    setPreviewVersion(null);
    setFragmentContents({});
  }, []);

  // Listen for the version.preview stateless event from TipTap Cloud
  useEffect(() => {
    const onStateless = (data: { payload: string }) => {
      try {
        const parsed = JSON.parse(data.payload) as { event: string };
        if (parsed.event !== 'version.preview') {
          return;
        }

        // Extract content for each fragment
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
        // Ignore non-JSON stateless messages
      }
    };

    provider.on('stateless', onStateless);
    return () => {
      provider.off('stateless', onStateless);
    };
  }, [provider, fragmentNames]);

  return (
    <VersionPreviewContext.Provider
      value={{
        previewVersion,
        fragmentContents,
        startPreview,
        exitPreview,
      }}
    >
      {children}
    </VersionPreviewContext.Provider>
  );
}

export function useVersionPreview(): VersionPreviewState {
  const ctx = useContext(VersionPreviewContext);
  if (!ctx) {
    throw new Error(
      'useVersionPreview must be used within a VersionPreviewProvider',
    );
  }
  return ctx;
}

export function useOptionalVersionPreview(): VersionPreviewState | null {
  return useContext(VersionPreviewContext);
}
