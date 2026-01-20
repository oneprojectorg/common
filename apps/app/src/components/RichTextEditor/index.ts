// Collaborative editor (real-time sync via TipTap Cloud)
export {
  CollaborativeEditor,
  type CollaborativeEditorProps,
  type CollaborativeEditorRef,
  useEditorMode,
  type EditorModeProps,
} from './CollaborativeEditor';

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
  getEditorExtensions, // Legacy alias for getProposalExtensions
  type EditorExtensionOptions,
} from './editorConfig';
