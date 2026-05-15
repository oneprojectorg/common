// Aggregated re-export of the shadcn `field` family + related primitives.
// Consumers import composite Field surfaces from `@op/ui-next/Field`.
//
// Notes:
//   - `FieldGroup` here is shadcn's vertical stacker (NEW).
//   - For the old `@op/ui` bordered compound-input wrapper, use `InputGroup`.
//   - `FieldError` auto-hides when no `errors` / `children` are provided.

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from './ui/field';

export { Label } from './ui/label';
export { Separator } from './ui/separator';

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from './ui/input-group';

export { Input, inputVariants } from './Input';
export type { InputProps, InputVariantsProps } from './Input';

export { Textarea, textareaVariants } from './Textarea';
export type { TextareaProps, TextareaVariantsProps } from './Textarea';
