'use client';

import { Formity } from '@formity/react';
import { useCallback, useState } from 'react';

import { schema } from './schema';

import type { Values } from './schema';
import type { OnReturn, ReturnOutput } from '@formity/react';

export const OnboardingFlow = () => {
  const [values, setValues] = useState<ReturnOutput<Values> | null>(null);

  const onReturn = useCallback<OnReturn<Values>>((values) => {
    setValues(values);
  }, []);

  if (values) {
    return <div>DONE!</div>;
  }

  return (
    <>
      <Formity<Values> schema={schema} onReturn={onReturn} onYield={onReturn} />
    </>
  );
};
