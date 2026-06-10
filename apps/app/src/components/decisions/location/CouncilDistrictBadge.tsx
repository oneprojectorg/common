import { useTranslations } from '@/lib/i18n';

import { COUNCIL_DISTRICT } from './mapConfig';

interface CouncilDistrictBadgeProps {
  /** Appends "(resolved from map)" — shown in the editable picker only. */
  resolvedFromMap?: boolean;
}

/**
 * The "Council District N" indicator beneath the map. Hardcoded for now (see
 * {@link COUNCIL_DISTRICT}); a backend that derives the district from the
 * placed point is a follow-up.
 */
export function CouncilDistrictBadge({
  resolvedFromMap = false,
}: CouncilDistrictBadgeProps) {
  const t = useTranslations();

  return (
    <span className="flex items-center gap-1.5 text-sm text-neutral-black">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-primary-teal"
      />
      {resolvedFromMap
        ? t('Council District {district} (resolved from map)', {
            district: COUNCIL_DISTRICT,
          })
        : t('Council District {district}', { district: COUNCIL_DISTRICT })}
    </span>
  );
}
