'use client';

import { trpc } from '@op/api/client';
import {
  type CustomFormDefinitionSchema,
  parseTranslatedMeta,
} from '@op/common/client';
import { useMemo } from 'react';

import { getCustomFormDetectionText } from '../translationDetectionText';
import { useTranslateLink } from '../useTranslateLink';

export type CustomFormTranslation = Pick<
  ReturnType<typeof parseTranslatedMeta>,
  'fieldTitles' | 'fieldDescriptions' | 'optionLabels'
> & {
  title?: string;
  description?: string;
};

/** The custom form modal's link: translates the form's own text via `translateCustomForm`. */
export const useTranslateCustomForm = ({
  customFormId,
  definition,
  isOpen,
}: {
  customFormId: string;
  definition?: CustomFormDefinitionSchema;
  isOpen: boolean;
}) => {
  const detectionText = useMemo(
    () => (definition ? getCustomFormDetectionText(definition) : ''),
    [definition],
  );

  const translateMutation = trpc.translation.translateCustomForm.useMutation();

  return useTranslateLink<CustomFormTranslation>({
    detectionText,
    enabled: isOpen && !!definition,
    request: (targetLocale) =>
      translateMutation
        .mutateAsync({ customFormId, targetLocale })
        // Nothing translated comes back as `{}`.
        .then(({ translated }) => {
          if (Object.keys(translated).length === 0) {
            return undefined;
          }
          const { title, description } = translated;
          return {
            ...parseTranslatedMeta(translated),
            title: typeof title === 'string' ? title : undefined,
            description:
              typeof description === 'string' ? description : undefined,
          };
        }),
  });
};
