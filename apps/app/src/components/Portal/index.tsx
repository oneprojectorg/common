import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type PortalSlot = 'top-slot';

export const Portal = ({
  children,
  id,
}: {
  children: ReactNode;
  id: PortalSlot;
}) => {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.getElementById(id);

    setPortalElement(element);
  }, [id]);

  if (!portalElement) {
    return null;
  }

  return createPortal(children, portalElement);
};
