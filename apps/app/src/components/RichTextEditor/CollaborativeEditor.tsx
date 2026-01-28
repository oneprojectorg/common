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
        user={user}
      />
    );
  },
);

type CollaborativeEditorInnerProps = Omit<CollaborativeEditorProps, 'docId'> & {
  ydoc: Doc;
  provider: TiptapCollabProvider;
  status: CollabStatus;
  isSynced: boolean;
  user?: CollabUser;
};

/** Inner component that renders after provider is ready */
/** Default user for cursor when no user info is provided */
const DEFAULT_COLLAB_USER: CollabUser = { name: 'Anonymous', color: '#f783ac' };

/** Builds the cursor caret element shown at other users' cursor positions */
function buildCursorElement(user: {
  name?: string;
  color?: string;
}): HTMLElement {
  const cursor = document.createElement('span');
  cursor.classList.add('collaboration-cursor__caret');
  cursor.setAttribute('style', `border-color: ${user.color ?? '#f783ac'}`);

  const label = document.createElement('div');
  label.classList.add('collaboration-cursor__label');
  label.setAttribute('style', `background-color: ${user.color ?? '#f783ac'}`);
  label.appendChild(document.createTextNode(user.name ?? 'Anonymous'));
  cursor.appendChild(label);

  return cursor;
}

/** Builds selection highlight attributes for other users' selections */
function buildSelectionAttrs(user: { color?: string }) {
  return {
    style: `background-color: ${user.color ?? '#f783ac'}70`,
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
      user,
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

    // Track if cursor plugin has been registered
    const cursorRegisteredRef = useRef(false);

    // Register cursor plugin lazily after editor mounts
    // This ensures ySyncPlugin state is established first
    useEffect(() => {
      console.log('[Cursor] Effect running', {
        hasEditor: !!editor,
        hasAwareness: !!provider.awareness,
        alreadyRegistered: cursorRegisteredRef.current,
      });

      if (!editor || !provider.awareness || cursorRegisteredRef.current) {
        return;
      }

      // Verify sync plugin is ready before registering cursor
      const syncState = ySyncPluginKey.getState(editor.state);
      console.log('[Cursor] Sync state:', syncState);

      if (!syncState) {
        // Sync plugin not ready yet, try again on next tick
        console.log('[Cursor] Sync not ready, will retry');
        const timer = setTimeout(() => {
          cursorRegisteredRef.current = false;
        }, 0);
        return () => clearTimeout(timer);
      }

      const awareness = provider.awareness;
      console.log(
        '[Cursor] Awareness states:',
        Array.from(awareness.getStates().entries()),
      );

      // Set user awareness
      const currentUser = user ?? DEFAULT_COLLAB_USER;
      awareness.setLocalStateField('user', currentUser);
      console.log('[Cursor] Set local user:', currentUser);

      // Create and register cursor plugin with custom rendering
      const cursorPlugin = yCursorPlugin(awareness, {
        cursorBuilder: buildCursorElement,
        selectionBuilder: buildSelectionAttrs,
      });
      editor.registerPlugin(cursorPlugin);
      cursorRegisteredRef.current = true;
      console.log('[Cursor] Plugin registered successfully');

      // Log awareness changes
      const onAwarenessChange = () => {
        console.log(
          '[Cursor] Awareness changed:',
          Array.from(awareness.getStates().entries()),
        );
      };
      awareness.on('change', onAwarenessChange);

      return () => {
        console.log('[Cursor] Cleaning up plugin');
        awareness.off('change', onAwarenessChange);
        editor.unregisterPlugin(cursorPlugin.key);
        cursorRegisteredRef.current = false;
      };
    }, [editor, provider, user]);

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
