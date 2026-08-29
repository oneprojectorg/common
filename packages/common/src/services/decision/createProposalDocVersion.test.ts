import { getTipTapClient } from '@op/collab';
import { logger } from '@op/logging';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommonError } from '../../utils';
import { createProposalDocVersion } from './createProposalDocVersion';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@op/collab', () => ({
  getTipTapClient: vi.fn(),
}));

const mockCreateVersion = vi.fn();

const args = {
  collaborationDocId: 'doc-1',
  versionName: 'Submitted',
  operation: 'submitProposal',
  failureMessage: 'We could not submit your proposal right now.',
};

describe('createProposalDocVersion', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
    mockCreateVersion.mockReset();
    vi.mocked(getTipTapClient).mockReturnValue({
      createVersion: mockCreateVersion,
    } as unknown as ReturnType<typeof getTipTapClient>);
  });

  it('returns the minted version number', async () => {
    mockCreateVersion.mockResolvedValue({ version: 7 });

    await expect(createProposalDocVersion(args)).resolves.toBe(7);
    expect(mockCreateVersion).toHaveBeenCalledWith('doc-1', {
      name: 'Submitted',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns version 0 rather than treating it as missing', async () => {
    mockCreateVersion.mockResolvedValue({ version: 0 });

    await expect(createProposalDocVersion(args)).resolves.toBe(0);
  });

  it('passes meta through only when supplied', async () => {
    mockCreateVersion.mockResolvedValue({ version: 1 });

    await createProposalDocVersion({
      ...args,
      meta: { eventType: 'resubmit' },
    });

    expect(mockCreateVersion).toHaveBeenCalledWith('doc-1', {
      name: 'Submitted',
      meta: { eventType: 'resubmit' },
    });
  });

  it('throws the caller-supplied message when TipTap rejects', async () => {
    mockCreateVersion.mockRejectedValue(new Error('503 Service Unavailable'));

    await expect(createProposalDocVersion(args)).rejects.toThrow(CommonError);
    await expect(createProposalDocVersion(args)).rejects.toThrow(
      args.failureMessage,
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[submitProposal] Failed to create TipTap version',
      expect.objectContaining({ collaborationDocId: 'doc-1' }),
    );
  });

  it('throws when TipTap resolves without a version', async () => {
    mockCreateVersion.mockResolvedValue(null);

    await expect(createProposalDocVersion(args)).rejects.toThrow(
      args.failureMessage,
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[submitProposal] TipTap created no version for document',
      { collaborationDocId: 'doc-1' },
    );
  });
});
