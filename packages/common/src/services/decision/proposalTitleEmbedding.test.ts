import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: drive the single joined read and the inference call, assert
// what gets written (or, more often, what doesn't).
const selectRows = vi.fn();
const insertValues = vi.fn();
const onConflictDoUpdate = vi.fn();

vi.mock('@op/db/client', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    leftJoin: () => selectChain,
    where: () => selectChain,
    limit: () => selectRows(),
  };
  return {
    ...actual,
    db: {
      select: () => selectChain,
      insert: () => ({
        values: (...args: unknown[]) => {
          insertValues(...args);
          return { onConflictDoUpdate };
        },
      }),
    },
  };
});

vi.mock('@op/ai', () => ({ createEmbeddings: vi.fn() }));

vi.mock('@op/logging', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { createEmbeddings } from '@op/ai';
import { PROPOSAL_TITLE_EMBEDDING_DIMENSIONS } from '@op/db/schema';
import { logger } from '@op/logging';

import {
  getProposalTitleQueryVector,
  syncProposalTitleEmbedding,
} from './proposalTitleEmbedding';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const PROCESS_INSTANCE_ID = '22222222-2222-4222-8222-222222222222';

const embed = vi.mocked(createEmbeddings);

const vectorOfWidth = (width: number): number[] =>
  Array.from({ length: width }, (_, index) => index / width);

const VALID_VECTOR = vectorOfWidth(PROPOSAL_TITLE_EMBEDDING_DIMENSIONS);

beforeEach(() => {
  vi.clearAllMocks();
  embed.mockResolvedValue([VALID_VECTOR]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('syncProposalTitleEmbedding', () => {
  it('embeds and upserts when the title has moved', async () => {
    selectRows.mockResolvedValue([
      {
        status: 'submitted',
        title: 'Community Garden Revamp',
        embeddedTitle: 'Community Garden',
      },
    ]);

    await syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID });

    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({ texts: ['Community Garden Revamp'] }),
    );
    expect(insertValues).toHaveBeenCalledWith({
      proposalId: PROPOSAL_ID,
      title: 'Community Garden Revamp',
      embedding: VALID_VECTOR,
    });
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it('uses AI_EMBEDDING_MODEL when set', async () => {
    vi.stubEnv('AI_EMBEDDING_MODEL', 'house-embed-1');
    selectRows.mockResolvedValue([
      { status: 'submitted', title: 'Bike Lanes', embeddedTitle: null },
    ]);

    await syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID });

    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({ model: { modelId: 'house-embed-1' } }),
    );
  });

  it('skips drafts, so autosave does not bill an inference call per keystroke', async () => {
    selectRows.mockResolvedValue([
      { status: 'draft', title: 'Half-written idea', embeddedTitle: null },
    ]);

    await syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID });

    expect(embed).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('skips an unchanged title', async () => {
    selectRows.mockResolvedValue([
      {
        status: 'submitted',
        title: 'Bike Lanes',
        embeddedTitle: 'Bike Lanes',
      },
    ]);

    await syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID });

    expect(embed).not.toHaveBeenCalled();
  });

  it('skips a proposal with no title', async () => {
    selectRows.mockResolvedValue([
      { status: 'submitted', title: '   ', embeddedTitle: null },
    ]);

    await syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID });

    expect(embed).not.toHaveBeenCalled();
  });

  it('refuses a vector whose width the column cannot hold', async () => {
    selectRows.mockResolvedValue([
      { status: 'submitted', title: 'Bike Lanes', embeddedTitle: null },
    ]);
    embed.mockResolvedValue([vectorOfWidth(768)]);

    await syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID });

    expect(insertValues).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Embedding model returned an unexpected vector width',
      expect.objectContaining({ received: 768 }),
    );
  });

  it('logs and returns when the provider fails, so the title write still succeeds', async () => {
    selectRows.mockResolvedValue([
      { status: 'submitted', title: 'Bike Lanes', embeddedTitle: null },
    ]);
    embed.mockRejectedValue(new Error('No inference URL configured'));

    await expect(
      syncProposalTitleEmbedding({ proposalId: PROPOSAL_ID }),
    ).resolves.toBeUndefined();

    expect(insertValues).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not refresh the proposal title embedding',
      expect.objectContaining({ proposalId: PROPOSAL_ID }),
    );
  });
});

describe('getProposalTitleQueryVector', () => {
  it('returns the stored vector without an inference call', async () => {
    selectRows.mockResolvedValue([
      { title: 'Bike Lanes', embedding: VALID_VECTOR },
    ]);

    await expect(
      getProposalTitleQueryVector({
        proposalId: PROPOSAL_ID,
        processInstanceId: PROCESS_INSTANCE_ID,
      }),
    ).resolves.toEqual(VALID_VECTOR);
    expect(embed).not.toHaveBeenCalled();
  });

  it('embeds inline for a proposal that predates the cache', async () => {
    selectRows.mockResolvedValue([{ title: 'Bike Lanes', embedding: null }]);

    await expect(
      getProposalTitleQueryVector({
        proposalId: PROPOSAL_ID,
        processInstanceId: PROCESS_INSTANCE_ID,
      }),
    ).resolves.toEqual(VALID_VECTOR);
    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({ texts: ['Bike Lanes'] }),
    );
  });

  it('returns null for a proposal outside the decision', async () => {
    selectRows.mockResolvedValue([]);

    await expect(
      getProposalTitleQueryVector({
        proposalId: PROPOSAL_ID,
        processInstanceId: PROCESS_INSTANCE_ID,
      }),
    ).resolves.toBeNull();
    expect(embed).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when inference is unavailable', async () => {
    selectRows.mockResolvedValue([{ title: 'Bike Lanes', embedding: null }]);
    embed.mockRejectedValue(new Error('No inference URL configured'));

    await expect(
      getProposalTitleQueryVector({
        proposalId: PROPOSAL_ID,
        processInstanceId: PROCESS_INSTANCE_ID,
      }),
    ).resolves.toBeNull();
  });
});
