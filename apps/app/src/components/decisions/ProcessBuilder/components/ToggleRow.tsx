import {
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useId,
} from 'react';

// Toggle row component for consistent styling matching Figma design
export function ToggleRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  const labelId = useId();
  const descriptionId = description ? `${labelId}-desc` : undefined;

  // Associate the visible label/description with the control (a base-ui Switch
  // has no accessible name otherwise — axe flags aria-toggle-field-name).
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-labelledby': labelId,
        'aria-describedby': descriptionId,
      })
    : children;

  return (
    <div className="flex items-center gap-4 rounded-xl py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <p id={labelId} className="text-base leading-[1.5] text-neutral-black">
          {label}
        </p>
        {description && (
          <p
            id={descriptionId}
            className="text-sm leading-[1.5] text-neutral-gray4"
          >
            {description}
          </p>
        )}
      </div>
      {control}
    </div>
  );
}
