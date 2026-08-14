import type { TranslatedFields } from './translatedFields';

/**
 * Splits a flat translation result (as produced by `translateProposal` or
 * `translateRubric`) into the per-field maps a renderer needs: field titles and
 * descriptions keyed by field key, and option labels and descriptions keyed by
 * field key then option value.
 */
export function parseTranslatedMeta(translated: TranslatedFields) {
  const fieldTitles: Record<string, string> = {};
  const fieldDescriptions: Record<string, string> = {};
  const optionLabels: Record<string, Record<string, string>> = {};
  const optionDescriptions: Record<string, Record<string, string>> = {};

  for (const [key, value] of Object.entries(translated)) {
    if (typeof value !== 'string') {
      continue;
    }

    if (key.startsWith('field_title:')) {
      fieldTitles[key.slice('field_title:'.length)] = value;
    } else if (key.startsWith('field_desc:')) {
      fieldDescriptions[key.slice('field_desc:'.length)] = value;
    } else if (key.startsWith('option:')) {
      assignOptionEntry(optionLabels, key.slice('option:'.length), value);
    } else if (key.startsWith('option_desc:')) {
      assignOptionEntry(
        optionDescriptions,
        key.slice('option_desc:'.length),
        value,
      );
    }
  }

  return { fieldTitles, fieldDescriptions, optionLabels, optionDescriptions };
}

/**
 * Files a `<fieldKey>:<optionValue>` remainder into a per-field option map.
 * Split on the first colon only — an option value may contain colons itself.
 */
function assignOptionEntry(
  target: Record<string, Record<string, string>>,
  rest: string,
  value: string,
) {
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) {
    return;
  }
  const fieldKey = rest.slice(0, colonIdx);
  const optionValue = rest.slice(colonIdx + 1);
  (target[fieldKey] ??= {})[optionValue] = value;
}
