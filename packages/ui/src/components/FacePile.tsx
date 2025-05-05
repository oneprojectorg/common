import { ReactNode } from 'react';

export const FacePile = ({
  items,
}: {
  children?: ReactNode;
  items: Array<ReactNode>;
}) => {
  return (
    <ul className="-gap-2 flex">
      {items.map((node) => (
        <li className="-ml-2">{node}</li>
      ))}
    </ul>
  );
};
