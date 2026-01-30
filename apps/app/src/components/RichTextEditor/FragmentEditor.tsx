'use client';

import {
  RichTextEditorSkeleton,
  StyledRichTextContent,
  useRichTextEditor,
} from '@op/ui/RichTextEditor';
import Snapshot from '@tiptap-pro/extension-snapshot';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type { Editor, Extensions } from '@tiptap/react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import type { CollabStatus } from '@/hooks/useTiptapCollab';

import { useCollaborativeEditors } from './CollaborativeEditorsProvider';

// How often to create a snapshot in version history
const AUTOVERSION_INTERVAL_SECONDS = 900; // 15 minutes

export interface FragmentEditorRef {
  editor: Editor | null;
  collabStatus: CollabStatus;
  isSynced: boolean;
}

export interface FragmentEditorProps {
  /** Yjs fragment name for this editor */
  fragment: string;
  extensions?: Extensions;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  editorClassName?: string;
  /**
   * Whether this editor should manage versioning for the shared document.
   * Only one editor in a multi-editor setup should have this enabled.
   * Defaults to false.
   */
  enableVersioning?: boolean;
}

/**
 * A collaborative editor that uses a specific fragment from a shared Yjs document.
 * Must be used within a CollaborativeEditorsProvider.
 */
export const FragmentEditor = forwardRef<FragmentEditorRef, FragmentEditorProps>(
  (
    {
      fragment,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      className = '',
      editorClassName = '',
      enableVersioning = false,
    },
    ref,
  ) => {
    const { ydoc, provider, status, isSynced, user } = useCollaborativeEditors();

    // Wait for provider before rendering the editor
    if (!provider) {
      return <RichTextEditorSkeleton className={className} />;
    }

    return (
      <FragmentEditorInner
        ref={ref}
        fragment={fragment}
        extensions={extensions}
        placeholder={placeholder}
        onEditorReady={onEditorReady}
        className={className}
        editorClassName={editorClassName}
        enableVersioning={enableVersioning}
        ydoc={ydoc}
        provider={provider}
        status={status}
        isSynced={isSynced}
        user={user}
      />
    );
  },
);

FragmentEditor.displayName = 'FragmentEditor';

interface FragmentEditorInnerProps extends FragmentEditorProps {
  ydoc: ReturnType<typeof useCollaborativeEditors>['ydoc'];
  provider: NonNullable<ReturnType<typeof useCollaborativeEditors>['provider']>;
  status: ReturnType<typeof useCollaborativeEditors>['status'];
  isSynced: ReturnType<typeof useCollaborativeEditors>['isSynced'];
  user: ReturnType<typeof useCollaborativeEditors>['user'];
}

const FragmentEditorInner = forwardRef<FragmentEditorRef, FragmentEditorInnerProps>(
  (
    {
      fragment,
      extensions = [],
      placeholder = 'Start writing...',
      onEditorReady,
      className = '',
      editorClassName = '',
      enableVersioning = false,
      ydoc,
      provider,
      status,
      isSynced,
      user,
    },
    ref,
  ) => {
    // Build collaborative extensions with cursor support
    const collaborativeExtensions = useMemo(
      () => [
        ...extensions,
        Collaboration.configure({ document: ydoc, fragment }),
        CollaborationCaret.configure({
          provider,
          user,
        }),
        ...(enableVersioning ? [Snapshot.configure({ provider })] : []),
      ],
      [extensions, ydoc, provider, user, fragment, enableVersioning],
    );

    const editor = useRichTextEditor({
      extensions: collaborativeExtensions,
      editorClassName,
      onEditorReady,
    });

    // Track whether versioning has been enabled to avoid toggling it off on re-render
    const versioningEnabledRef = useRef(false);

    // Enable autoversioning when editor is ready and connected (only if this editor manages versioning)
    useEffect(() => {
      if (
        !enableVersioning ||
        !editor ||
        status !== 'connected' ||
        versioningEnabledRef.current
      ) {
        return;
      }

      const configMap = ydoc.getMap<number>('__tiptapcollab__config');
      configMap.set('intervalSeconds', AUTOVERSION_INTERVAL_SECONDS);

      editor.commands.toggleVersioning();
      versioningEnabledRef.current = true;
    }, [editor, status, ydoc, enableVersioning]);

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

FragmentEditorInner.displayName = 'FragmentEditorInner';
