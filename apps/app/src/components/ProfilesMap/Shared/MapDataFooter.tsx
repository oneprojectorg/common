'use client';

import { LuInfo, LuShield, LuMapPin } from 'react-icons/lu';

export function MapDataFooter() {
  return (
    <div className="bg-neutral-offWhite border-t border-neutral-gray2 px-4 py-3">
      <div className="flex flex-wrap items-start gap-6 text-sm text-neutral-gray4">
        {/* Data Source */}
        <div className="flex items-start gap-2">
          <LuInfo className="mt-0.5 size-4 flex-shrink-0 text-neutral-gray3" />
          <div>
            <span className="font-medium text-neutral-charcoal">Data Source:</span>{' '}
            Profile locations are based on publicly shared information and user-provided data within your organization's network.
          </div>
        </div>

        {/* Location Precision */}
        <div className="flex items-start gap-2">
          <LuMapPin className="mt-0.5 size-4 flex-shrink-0 text-neutral-gray3" />
          <div>
            <span className="font-medium text-neutral-charcoal">Location Precision:</span>{' '}
            Locations are approximate and may be adjusted for privacy. City-level precision is typical.
          </div>
        </div>
      </div>
    </div>
  );
}