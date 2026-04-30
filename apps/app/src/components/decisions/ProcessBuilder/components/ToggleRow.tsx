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
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-base leading-[1.5] text-foreground">{label}</p>
        {description && (
          <p className="text-sm leading-[1.5] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
