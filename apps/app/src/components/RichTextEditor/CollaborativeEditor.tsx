'use client';

import {
  type CollabStatus,
  type CollabUser,
  useTiptapCollab,
} from '@/hooks/useTiptapCollab';
import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';
import Collaboration from '@tiptap/extension-collaboration';
import type { Editor, Extensions } from '@tiptap/react';
import { yCursorPlugin, ySyncPluginKey } from '@tiptap/y-tiptap';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { Doc } from 'yjs';

// How often to create a snapshot in version history
const AUTOVERSION_INTERVAL_SECONDS = 900; // 15 minutes

export interface CollaborativeEditorRef {
  editor: Editor | null;
  collabStatus: CollabStatus;
  isSynced: boolean;
}

export interface CollaborativeEditorProps {
  docId: string;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  /** Called when the collaboration provider is ready */
  onProviderReady?: (provider: TiptapCollabProvider) => void;
  className?: string;
  editorClassName?: string;
  user?: CollabUser;
}

/** Rich text editor with real-time collaboration via TipTap Cloud */
export const CollaborativeEditor = forwardRef<
  CollaborativeEditorRef,
  CollaborativeEditorProps
>(
  (
    {
      docId,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      onProviderReady,
      className = '',
      editorClassName = '',
      user,
    },
    ref,
  ) => {
    const { ydoc, provider, status, isSynced } = useTiptapCollab({
      docId,
      enabled: true,
      user,
    });

    // Notify parent when provider becomes available
    useEffect(() => {
      if (provider && onProviderReady) {
        onProviderReady(provider);
      }
    }, [provider, onProviderReady]);

    // Wait for provider before rendering the editor inner component
    // This ensures Snapshot extension is included from the start
    if (!provider) {
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <CollaborativeEditorInner
        ref={ref}
        ydoc={ydoc}
        provider={provider}
        status={status}
        isSynced={isSynced}
        extensions={extensions}
        placeholder={placeholder}
        onEditorReady={onEditorReady}
        className={className}
        editorClassName={editorClassName}
      />
    );
  },
);

type CollaborativeEditorInnerProps = Omit<
  CollaborativeEditorProps,
  'docId' | 'user'
> & {
  ydoc: Doc;
  provider: TiptapCollabProvider;
  status: CollabStatus;
  isSynced: boolean;
};

const DEFAULT_CURSOR_COLOR = '#f783ac';

interface CursorUser {
  name?: string;
  color?: string;
}

/** Builds the cursor caret element shown at other users' cursor positions */
function buildCursorElement(user: CursorUser): HTMLElement {
  const cursor = document.createElement('span');
  cursor.className = 'collaboration-cursor__caret';
  cursor.style.setProperty(
    '--cursor-color',
    user.color ?? DEFAULT_CURSOR_COLOR,
  );

  const label = document.createElement('div');
  label.className = 'collaboration-cursor__label';
  label.textContent = user.name ?? 'Anonymous';
  cursor.appendChild(label);

  return cursor;
}

/** Builds selection highlight attributes for other users' selections */
function buildSelectionAttrs(user: CursorUser) {
  return {
    style: `--cursor-color: ${user.color ?? DEFAULT_CURSOR_COLOR}`,
    class: 'collaboration-cursor__selection',
  };
}

const CollaborativeEditorInner = forwardRef<
  CollaborativeEditorRef,
  CollaborativeEditorInnerProps
>(
  (
    {
      ydoc,
      provider,
      status,
      isSynced,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      className = '',
      editorClassName = '',
    },
    ref,
  ) => {
    // Build extensions WITHOUT cursor - we'll add the cursor plugin lazily
    // to avoid race condition where cursor plugin init runs before sync plugin state exists
    const collaborativeExtensions = useMemo(
      () => [
        ...extensions,
        Collaboration.configure({ document: ydoc }),
        Snapshot.configure({ provider }),
      ],
      [extensions, ydoc, provider],
    );

    const editor = useRichTextEditor({
      extensions: collaborativeExtensions,
      editorClassName,
      onEditorReady,
    });

    // NOTE: Using yCursorPlugin directly instead of CollaborationCaret extension
    // because TipTap doesn't guarantee plugin order - ySyncPlugin state may not
    // exist when the extension initializes. Lazy registration lets us wait for sync.
    // See: https://tiptap.dev/docs/editor/extensions/functionality/collaboration-caret
    useEffect(() => {
      if (!editor || !provider.awareness) {
        return;
      }

      // Verify sync plugin is ready before registering cursor
      const syncState = ySyncPluginKey.getState(editor.state);
      if (!syncState) {
        return;
      }

      // Check if cursor plugin is already registered (handles HMR race conditions)
      const cursorPluginKey = 'yjs-cursor$';
      const existingPlugin = editor.state.plugins.find(
        (p) => p.spec.key && String(p.spec.key).startsWith(cursorPluginKey),
      );
      if (existingPlugin) {
        return;
      }

      // Create and register cursor plugin with custom rendering
      const cursorPlugin = yCursorPlugin(provider.awareness, {
        cursorBuilder: buildCursorElement,
        selectionBuilder: buildSelectionAttrs,
      });
      editor.registerPlugin(cursorPlugin);

      return () => {
        editor.unregisterPlugin(cursorPlugin.key);
      };
    }, [editor, provider]);

    // Track whether versioning has been enabled to avoid toggling it off on re-render
    const versioningEnabledRef = useRef(false);

    // Enable autoversioning when editor is ready and connected
    useEffect(() => {
      if (!editor || status !== 'connected' || versioningEnabledRef.current) {
        return;
      }

      const configMap = ydoc.getMap<number>('__tiptapcollab__config');
      configMap.set('intervalSeconds', AUTOVERSION_INTERVAL_SECONDS);

      editor.commands.toggleVersioning();
      versioningEnabledRef.current = true;
    }, [editor, status, ydoc]);

    useImperativeHandle(
      ref,
      () => ({
        editor,
        collabStatus: status,
        isSynced,
      }),
      [editor, status, isSynced],
    );

    if (!editor) {
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <div className={className}>
        <StyledRichTextContent editor={editor} placeholder={placeholder} />
      </div>
    );
  },
);

CollaborativeEditorInner.displayName = 'CollaborativeEditorInner';

CollaborativeEditor.displayName = 'CollaborativeEditor';
