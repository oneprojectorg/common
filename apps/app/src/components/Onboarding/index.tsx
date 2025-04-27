'use client';

import { Formity } from '@formity/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { trpc } from '@op/trpc/client';

import { schema } from './schema';

import type { Values } from './schema';
import type { OnReturn, ReturnOutput } from '@formity/react';

const processInputs = (data: ReturnOutput<Values>) => {
  const inputs = {
    ...data,
  };

  return inputs;
};

export const OnboardingFlow = () => {
  const [values, setValues] = useState<ReturnOutput<Values> | null>(null);
  const createOrganization = trpc.organization.create.useMutation();
  const router = useRouter();

  const onReturn = useCallback<OnReturn<Values>>(
    (values) => {
      setValues(values);
      createOrganization
        .mutateAsync(processInputs(values))
        .then((newOrg) => {
          router.push(`/app/org/${newOrg.slug}?new=1`);
        })
        .catch((err) => {
          console.error('ERROR', err);
        });
    },
    [createOrganization],
  );

  if (values) {
    return <div>Processing...</div>;
  }

  return (
    <>
      <Formity<Values> schema={schema} onReturn={onReturn} onYield={onReturn} />
    </>
  );
};
