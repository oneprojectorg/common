export type RequireAccessibleName<T> = T &
  ({ 'aria-label': string } | { 'aria-labelledby': string });
