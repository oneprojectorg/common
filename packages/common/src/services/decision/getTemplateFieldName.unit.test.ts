import { describe, expect, it } from 'vitest';

import { getTemplateFieldName } from './getTemplateFieldName';
import type { ProposalTemplateSchema } from './types';

const proposalTemplate: ProposalTemplateSchema = {
  type: 'object',
  properties: {
    f1a2b3c4: { type: 'number', title: 'Cost' },
    untitled: { type: 'number', title: '  ' },
  },
};

describe('getTemplateFieldName', () => {
  it('names a field by its title, not its ID', () => {
    expect(
      getTemplateFieldName({ proposalTemplate, fieldKey: 'f1a2b3c4' }),
    ).toBe('Cost');
  });

  it('falls back to the ID when the field has no title', () => {
    expect(
      getTemplateFieldName({ proposalTemplate, fieldKey: 'untitled' }),
    ).toBe('untitled');
  });

  it('falls back to the ID when the field is not on the template', () => {
    expect(getTemplateFieldName({ proposalTemplate, fieldKey: 'gone' })).toBe(
      'gone',
    );
    expect(
      getTemplateFieldName({ proposalTemplate: null, fieldKey: 'gone' }),
    ).toBe('gone');
  });
});
