import type { ReactNode } from 'react';
import type { z } from 'zod';

export interface StepperItem {
  key: number;
  label: string;
  validator?: z.ZodObject<Record<string, z.ZodTypeAny>>;
  component: ReactNode;
}
