// Pure re-export of shadcn's Checkbox primitive. No compat layer — consumers
// use the shadcn API directly: `<Checkbox checked onCheckedChange disabled />`
// paired with `<Label htmlFor>` for the visible label.
//
// For grouped checkboxes with a label/description/error, compose with
// `<Field>` + `<FieldLabel>` + `<FieldDescription>` + `<FieldError>` from
// `@op/ui-next/Field`.

export { Checkbox } from './ui/checkbox';
