import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@op/sense/Field';
import { cn } from '@op/sense/lib/utils';
import {
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useId,
} from 'react';

// A label + optional description beside a control (e.g. a Switch).
export const ToggleRow = ({
  label,
  description,
  className,
  children,
}: {
  label: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) => {
  const controlId = useId();
  const descriptionId = description ? `${controlId}-desc` : undefined;

  // The shadcn/base-ui Switch pattern: give the control an id and point the
  // label's htmlFor at it. base-ui's Switch renders a hidden <input> carrying
  // that id (a real labelable field), so the <label> associates cleanly and
  // base-ui mirrors it onto the visible span[role=switch].
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: controlId,
        'aria-describedby': descriptionId,
      })
    : children;

  return (
    <Field
      orientation="horizontal"
      className={cn('rounded-xl py-2', className)}
    >
      <FieldContent>
        <FieldLabel htmlFor={controlId} className="text-base">
          {label}
        </FieldLabel>
        {description && (
          <FieldDescription
            id={descriptionId}
            className="text-muted-foreground"
          >
            {description}
          </FieldDescription>
        )}
      </FieldContent>
      {control}
    </Field>
  );
};
