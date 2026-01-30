// Collaborative editor (real-time sync via TipTap Cloud)
export {
  CollaborativeEditor,
  type CollaborativeEditorProps,
  type CollaborativeEditorRef,
} from './CollaborativeEditor';

// Multi-editor collaboration with fragments (one doc, multiple editors)
export {
  CollaborativeEditorsProvider,
  type CollaborativeEditorsProviderProps,
  useCollaborativeEditors,
} from './CollaborativeEditorsProvider';
export {
  FragmentEditor,
  type FragmentEditorProps,
  type FragmentEditorRef,
} from './FragmentEditor';

// Collaborative presence indicator (avatar stack)
export { CollaborativePresence } from './CollaborativePresence';

// App-specific RichTextEditor with toolbar (non-collaborative)
export {
  RichTextEditorWithToolbar,
  type RichTextEditorWithToolbarProps,
} from './RichTextEditorWithToolbar';

// App-specific toolbar components
export { RichTextEditorToolbar } from './RichTextEditorToolbar';
export { RichTextEditorFloatingToolbar } from './RichTextEditorFloatingToolbar';
export { useRichTextEditorFloatingToolbar } from './useRichTextEditorFloatingToolbar';

// App-specific editor extensions
export {
  getProposalExtensions,
  getViewerExtensions,
  type EditorExtensionOptions,
} from './editorConfig';
