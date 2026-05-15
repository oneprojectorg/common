// Pure re-export of shadcn's RadioGroup primitive. No compat layer.
//
// Usage:
//   <RadioGroup value={x} onValueChange={setX}>
//     <RadioGroupItem id="a" value="a" />
//     <label htmlFor="a">A</label>
//   </RadioGroup>
//
// For label/description/error composition, wrap with `<Field>` +
// `<FieldLabel>` + `<FieldDescription>` + `<FieldError>` from
// `@op/ui-next/Field`.

export { RadioGroup, RadioGroupItem } from './ui/radio-group';
