import type { XFormatPropertySchema } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import { resolveProposalCategory } from './resolveProposalCategory';

const schemaWithOptions: XFormatPropertySchema = {
  type: 'string',
  oneOf: [{ const: 'parks', title: 'Parks' }],
};

const schemaWithoutOptions: XFormatPropertySchema = {
  type: 'string',
};

describe('resolveProposalCategory', () => {
  it('returns undefined when the template has no category property', () => {
    expect(resolveProposalCategory(undefined, ['parks'])).toBeUndefined();
  });

  it('returns undefined when the category property has no selectable options', () => {
    expect(
      resolveProposalCategory(schemaWithoutOptions, ['parks']),
    ).toBeUndefined();
  });

  it('returns undefined when categories are selectable but none were picked', () => {
    expect(resolveProposalCategory(schemaWithOptions, [])).toBeUndefined();
  });

  it('returns the selected categories when at least one was picked', () => {
    expect(resolveProposalCategory(schemaWithOptions, ['parks'])).toEqual([
      'parks',
    ]);
  });
});
