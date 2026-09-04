/**
 * Page sizes for list endpoints. sm: pickers, typeahead, peeks. md: the
 * default page. lg: long, light lists. max: the upper bound accepted on any
 * `limit` input.
 */
export const PAGE_LIMIT = { sm: 10, md: 20, lg: 50, max: 100 } as const;
