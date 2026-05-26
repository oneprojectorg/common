import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

export function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn('rounded-md p-1', className)}>
      {children}
    </Badge>
  );
}
