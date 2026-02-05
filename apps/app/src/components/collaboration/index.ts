// Collaborative document context (shared ydoc/provider for all fields)
export {
  CollaborativeDocProvider,
  useCollaborativeDoc,
} from './CollaborativeDocContext';

// Collaborative rich text editor (real-time sync via TipTap Cloud)
export {
  CollaborativeEditor,
  type CollaborativeEditorProps,
  type CollaborativeEditorRef,
} from './CollaborativeEditor';

// Collaborative plain text title field
export { CollaborativeTitleField } from './CollaborativeTitleField';

// Collaborative presence indicator (avatar stack)
export { CollaborativePresence } from './CollaborativePresence';

// Plain text editor extensions (for title fields)
export { getPlainTextExtensions } from './plainTextExtensions';
