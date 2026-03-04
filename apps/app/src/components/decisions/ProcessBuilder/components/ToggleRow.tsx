// Toggle row component for consistent styling matching Figma design
export function ToggleRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base leading-[1.5] text-neutral-black">{label}</p>
        {description && (
          <p className="text-sm leading-[1.5] text-neutral-charcoal">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
