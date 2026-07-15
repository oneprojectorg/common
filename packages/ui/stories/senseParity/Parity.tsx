// Shared building blocks for the Figma Parity stories: a committed design
// export rendered next to the live @op/sense component, one row per case.
//
// Conventions (see also assets/figma/figma-nodes.json):
// - Exports are @2x PNGs rendered at half their pixel width so they stay
//   crisp on retina displays and 1 rendered CSS pixel = 1 design pixel.
// - The design is authored at a 16px root font-size; the app root is still
//   smaller, so parity stories wrap in `withDesignScale` to force 16px on
//   <html> and compare at true design scale.

import type { Decorator } from '@storybook/react-vite';
import { useEffect } from 'react';

import { type ParityStatus, parityStatus } from './parityStatus';

export const withDesignScale: Decorator = (Story) => {
  useEffect(() => {
    const previous = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = '16px';
    return () => {
      document.documentElement.style.fontSize = previous;
    };
  }, []);
  return <Story />;
};

export function ParityRow({
  label,
  img,
  imgWidth,
  children,
}: {
  label: string;
  img: string;
  /** Rendered CSS width: half the @2x export's pixel width. */
  imgWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col">
      <p className="border-t border-neutral-gray4 bg-neutral-gray1/60 px-3 py-2 font-mono text-xs text-neutral-charcoal uppercase">
        {label}
      </p>
      <div className="grid w-full grid-cols-2 items-start gap-x-8 pt-4">
        <div className="min-w-0">
          <img
            src={img}
            alt={`Figma mock: ${label}`}
            style={{ width: imgWidth }}
            className="h-auto max-w-full"
          />
        </div>
        <div className="sense min-w-0">
          <div style={{ minWidth: `min(${imgWidth}px, 100%)` }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ParityGridHeader() {
  return (
    <div className="grid w-full grid-cols-2 gap-x-8">
      <ParityHeading>Figma (@2x)</ParityHeading>
      <ParityHeading>@op/sense (live)</ParityHeading>
    </div>
  );
}

export function ParityHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-neutral-gray4 uppercase">{children}</p>
  );
}

const statusStyles: Record<ParityStatus, string> = {
  todo: 'bg-neutral-gray1 text-neutral-gray4',
  'in-progress': 'bg-primary-yellow-500/20 text-neutral-charcoal',
  done: 'bg-functional-green-100 text-functional-green-600',
};

export function StatusBadge({ status }: { status: ParityStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-xs ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

export function StatusBoard() {
  const families = [
    ...new Set(Object.values(parityStatus).map((e) => e.family)),
  ];
  return (
    <div className="flex flex-col gap-8 p-8">
      {families.map((family) => (
        <div key={family}>
          <p className="pb-2 font-mono text-xs text-neutral-gray4 uppercase">
            {family}
          </p>
          <div className="grid w-fit grid-cols-[14rem_max-content] gap-x-8 gap-y-1">
            {Object.entries(parityStatus)
              .filter(([, e]) => e.family === family)
              .map(([name, e]) => (
                <div key={name} className="contents">
                  <p className="text-sm">{name}</p>
                  <StatusBadge status={e.status} />
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
