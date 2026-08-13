// Shared option shape for the multi-select fields (GeoNames / Terms / focus areas).
export interface Option {
  id: string;
  label: string;
  definition?: string | null;
  isNewValue?: boolean;
  level?: number;
  hasChildren?: boolean;
}
