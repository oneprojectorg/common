import { useTranslations } from '@/lib/i18n';

interface CouncilDistrictBadgeProps {
  /** Resolved boundary name. The badge renders nothing when absent. */
  boundaryName: string | null | undefined;
  /** Appends "(resolved from map)" — shown in the editable picker only. */
  resolvedFromMap?: boolean;
}

/**
 * The district indicator beneath the map, showing the boundary that contains
 * the placed point (resolved server-side from the persisted boundaries).
 * Renders nothing when the point falls outside every boundary.
 */
export function CouncilDistrictBadge({
  boundaryName,
  resolvedFromMap = false,
}: CouncilDistrictBadgeProps) {
  const t = useTranslations();

  if (!boundaryName) {
    return null;
  }

  return (
    <span className="flex items-center gap-1.5 text-sm text-neutral-black">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-primary-teal"
      />
      {resolvedFromMap
        ? t('{boundary} (resolved from map)', { boundary: boundaryName })
        : boundaryName}
    </span>
  );
}
