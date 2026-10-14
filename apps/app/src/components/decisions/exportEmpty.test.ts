import { describe, expect, it } from 'vitest';

import { isExportEmpty } from './exportEmpty';

describe('isExportEmpty', () => {
  it('is not empty while the list counts something', () => {
    expect(
      isExportEmpty({ isListEmpty: false, rejectedCount: 0, errored: false }),
    ).toBe(false);
  });

  it('is not empty when the phase holds only rejected proposals', () => {
    // This pins the regression. The list leaves rejected proposals out, so a
    // phase holding nothing else counted zero and disabled the export.
    expect(
      isExportEmpty({ isListEmpty: true, rejectedCount: 2, errored: false }),
    ).toBe(false);
  });

  it('is empty when the phase holds no rejected proposals either', () => {
    expect(
      isExportEmpty({ isListEmpty: true, rejectedCount: 0, errored: false }),
    ).toBe(true);
  });

  it('is empty while the rejected count is pending', () => {
    expect(
      isExportEmpty({
        isListEmpty: true,
        rejectedCount: undefined,
        errored: false,
      }),
    ).toBe(true);
  });

  it('is not empty when the rejected count could not be read', () => {
    expect(
      isExportEmpty({
        isListEmpty: true,
        rejectedCount: undefined,
        errored: true,
      }),
    ).toBe(false);
  });

  it('follows a count already read when a later read fails', () => {
    expect(
      isExportEmpty({ isListEmpty: true, rejectedCount: 0, errored: true }),
    ).toBe(true);
  });
});
