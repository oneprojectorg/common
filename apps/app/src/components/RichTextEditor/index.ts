// App-specific RichTextEditor with toolbar
export { RichTextEditorWithToolbar, type RichTextEditorWithToolbarProps } from './RichTextEditorWithToolbar';

// Re-export from @op/ui for convenience
export {
  RichTextEditor,
  RichTextViewer,
  type RichTextEditorRef,
} from '@op/ui/RichTextEditor';

// App-specific toolbar components
export { RichTextEditorToolbar } from './RichTextEditorToolbar';
export { RichTextEditorFloatingToolbar } from './RichTextEditorFloatingToolbar';
export { useRichTextEditorFloatingToolbar } from './useRichTextEditorFloatingToolbar';

// App-specific editor extensions
export { getEditorExtensions, getViewerExtensions } from './editorConfig';
