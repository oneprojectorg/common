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
