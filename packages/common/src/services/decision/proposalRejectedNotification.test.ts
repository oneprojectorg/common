import { RejectionReason } from '@op/core/decisions';
import { ProposalRejectedEmail, render } from '@op/emails';
import { describe, expect, it } from 'vitest';

describe('ProposalRejectedEmail', () => {
  // Emails are outside i18n, so the enum → sentence map lives in the template.
  // A raw `off-topic` in the body means that map was bypassed.
  it('explains the reason in a full sentence rather than leaking the enum value', async () => {
    const html = await render(
      ProposalRejectedEmail(ProposalRejectedEmail.PreviewProps),
    );

    expect(html).toContain('It falls outside what this process covers.');
    expect(html).not.toContain('off-topic');
  });

  // `satisfies` catches a reason with no copy; this catches one whose copy is
  // wrong. INFEASIBLE stops before its apostrophe, which the renderer escapes.
  it.each([
    [
      RejectionReason.INELIGIBLE,
      'It did not meet the eligibility rules for this process.',
    ],
    [
      RejectionReason.DUPLICATE,
      'Another proposal already under review covers the same idea.',
    ],
    [RejectionReason.OFF_TOPIC, 'It falls outside what this process covers.'],
    [
      RejectionReason.INFEASIBLE,
      'The review team found it could not be delivered within the program',
    ],
  ])('has reader-facing copy for %s', async (reason, sentence) => {
    const html = await render(
      ProposalRejectedEmail({ ...ProposalRejectedEmail.PreviewProps, reason }),
    );

    expect(html).toContain(sentence);
  });

  it('names the phase the proposal failed to reach', async () => {
    const html = await render(
      ProposalRejectedEmail({
        ...ProposalRejectedEmail.PreviewProps,
        phaseName: 'Voting',
      }),
    );

    expect(html).toContain('did not advance to Voting.');
  });

  // The last phase has nothing after it, so there is no phase to name.
  it('still reads as a sentence when there is no phase to name', async () => {
    const html = await render(
      ProposalRejectedEmail({
        ...ProposalRejectedEmail.PreviewProps,
        phaseName: undefined,
      }),
    );

    expect(html).toContain('did not advance.');
    expect(html).not.toContain('did not advance to');
  });

  it('omits the note block and its label when the admin wrote none', async () => {
    const html = await render(
      ProposalRejectedEmail({
        ...ProposalRejectedEmail.PreviewProps,
        note: undefined,
      }),
    );

    expect(html).not.toContain('A note from the review team');
    expect(html).not.toContain('transit funding');
  });

  // The sparsest email we send: final phase, no note. Both optional blocks drop
  // out at once, and what is left still has to read as finished copy.
  it('reads as finished copy with neither a phase nor a note', async () => {
    const html = await render(
      ProposalRejectedEmail({
        ...ProposalRejectedEmail.PreviewProps,
        phaseName: undefined,
        note: undefined,
      }),
    );

    expect(html).toContain('did not advance.');
    expect(html).toContain('It falls outside what this process covers.');
    expect(html).not.toContain('A note from the review team');
    expect(html).toContain('View proposal');
  });

  it('labels the note when the admin wrote one', async () => {
    const html = await render(
      ProposalRejectedEmail(ProposalRejectedEmail.PreviewProps),
    );

    expect(html).toContain('A note from the review team:');
    expect(html).toContain('transit funding');
  });

  // The note is whatever the admin typed into the dialog.
  it('escapes an untrusted note', async () => {
    const html = await render(
      ProposalRejectedEmail({
        ...ProposalRejectedEmail.PreviewProps,
        note: '<script>alert(1)</script>',
      }),
    );

    expect(html).not.toContain('<script>');
  });
});

describe('ProposalRejectedEmail.subject', () => {
  it('is the same line for every proposal, as the design specifies', () => {
    expect(ProposalRejectedEmail.subject()).toBe(
      'Your proposal did not advance',
    );
  });
});
