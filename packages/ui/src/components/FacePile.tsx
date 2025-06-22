import { ReactNode, forwardRef } from 'react';

export const FacePile = forwardRef<
  HTMLUListElement,
  { items: Array<ReactNode> }
>(({ items }: { children?: ReactNode; items: Array<ReactNode> }, ref) => {
  return (
    <ul className="-gap-2 flex" ref={ref}>
      {items.map((node, i) => (
        <li key={i} className="relative -ml-2">
          {node}
        </li>
      ))}
    </ul>
  );
});
