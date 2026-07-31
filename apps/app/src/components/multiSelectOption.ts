// Shared option shape for the multi-select fields (GeoNames / Terms / focus areas).
// Structurally matches the legacy @op/ui MultiSelectComboBox `Option`; kept here so
// migrated (sense-based) consumers don't depend on @op/ui for the type.
export interface Option {
  id: string;
  label: string;
  definition?: string | null;
  isNewValue?: boolean;
  level?: number;
  hasChildren?: boolean;
}
