
import { Building, CircleUserRound } from 'lucide-react';
import React, { Children, cloneElement } from 'react';

export interface MapProfileIconProps {
  profileType: 'individual' | 'organization';
}

export function MapProfileIcon({
  profileType,
}: MapProfileIconProps): React.ReactElement {
  const isOrg = profileType !== 'individual';

  const orgColor = 'fill-teal-500';
  const individualColor = 'fill-emerald-700';

  return isOrg ? (
    <SvgIconWrapper shape="square" backgroundClassName={orgColor}>
      <Building size={20} />
    </SvgIconWrapper>
  ) : (
    <SvgIconWrapper shape="circle" backgroundClassName={individualColor}>
      <CircleUserRound size={22} />
    </SvgIconWrapper>
  );
}


interface SvgIconWrapperProps {
  children: React.ReactElement;
  shape: 'square' | 'circle';
  backgroundClassName: string;
  padding?: number;
}

/**
 * A component that wraps a child icon (like a lucide-react icon) inside a parent SVG.
 * The parent SVG provides a background shape and automatically expands to fit the child plus padding.
 */
const SvgIconWrapper: React.FC<SvgIconWrapperProps> = ({
                                                         children,
                                                         shape,
                                                         backgroundClassName,
                                                         padding = 6,
                                                       }) => {
  // We inspect the child's props to determine its size.
  const child = Children.only(children);
  const childSize = child.props.size || 24; // Default to 24 if no size is provided

  // The parent SVG's size is the child's size plus padding on all sides.
  const parentSize = childSize + padding * 2;

  // The child SVG is positioned at (padding, padding) within the parent.
  const childX = padding;
  const childY = padding;

  // Clone the child to ensure it has a consistent color and stroke for visibility on the background.
  const icon = cloneElement(child, {
    color: 'white',
    strokeWidth: 1.5,
  });

  return (
    <svg
      width={parentSize}
      height={parentSize}
      viewBox={`0 0 ${parentSize} ${parentSize}`}
      fill={"transparent"}
      className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-110 [filter:drop-shadow(0_1px_2px_rgb(0,0,0,0.2))]"
    >
      {/* Background Shape */}
      {shape === 'square' ? (
        <rect x="0" y="0" width={parentSize} height={parentSize} rx="6" className={backgroundClassName} />
      ) : (
        <circle cx={parentSize / 2} cy={parentSize / 2} r={parentSize / 2 - 1} className={backgroundClassName}  />
      )}
      {/* Nested SVG to render the icon on top, correctly positioned */}
      <svg x={childX} y={childY}>{icon}</svg>
    </svg>
  );
};