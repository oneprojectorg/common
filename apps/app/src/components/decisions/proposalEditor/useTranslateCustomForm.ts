'use client';

import { trpc } from '@op/api/client';
import type {
  CustomFormDefinitionSchema,
  CustomFormTranslation,
} from '@op/common/client';
import { useMemo } from 'react';

import { useTranslateLink } from '../useTranslateLink';

/** Cap the sample fed to language detection — a few hundred chars already suffices. */
const MAX_SAMPLE_LENGTH = 2000;

/** The custom form modal's link: translates the form's own text via `translateCustomForm`. */
export const useTranslateCustomForm = ({
  customFormId,
  definition,
}: {
  customFormId: string;
  definition?: CustomFormDefinitionSchema;
}) => {
  const detectionText = useMemo(
    () => (definition ? getCustomFormDetectionText(definition) : ''),
    [definition],
  );

  const translateMutation = trpc.translation.translateCustomForm.useMutation();

  return useTranslateLink<CustomFormTranslation>({
    detectionText,
    enabled: !!definition,
    request: (targetLocale) =>
      translateMutation
        .mutateAsync({ customFormId, targetLocale })
        // Nothing translated comes back as `{}`.
        .then(({ translated }) =>
          Object.keys(translated).length > 0 ? translated : undefined,
        ),
  });
};

function getCustomFormDetectionText(
  definition: CustomFormDefinitionSchema,
): string {
  const parts = [definition.title, definition.description];
  for (const field of Object.values(definition.properties ?? {})) {
    if (field && typeof field === 'object') {
      parts.push(field.title, field.description);
    }
  }

  return parts
    .filter((part): part is string => typeof part === 'string' && !!part)
    .join('\n')
    .slice(0, MAX_SAMPLE_LENGTH);
}
