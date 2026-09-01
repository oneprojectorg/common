import { ProposalRejectedEmail, render } from '@op/emails';
import { describe, expect, it } from 'vitest';

describe('ProposalRejectedEmail', () => {
  // Emails are outside i18n, so the enum → label map lives in the template.
  // A raw `off-topic` in the body means that map was bypassed.
  it('names the reason in prose rather than leaking the enum value', async () => {
    const html = await render(
      ProposalRejectedEmail(ProposalRejectedEmail.PreviewProps),
    );

    expect(html).toContain('Off-topic');
    expect(html.replace(/Off-topic/g, '')).not.toContain('off-topic');
  });

  it('omits the note block when the admin wrote none', async () => {
    const html = await render(
      ProposalRejectedEmail({
        ...ProposalRejectedEmail.PreviewProps,
        note: undefined,
      }),
    );

    expect(html).toContain('Off-topic');
    expect(html).not.toContain('transit funding');
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
  it('names the proposal', () => {
    expect(ProposalRejectedEmail.subject('Community Garden Revamp')).toBe(
      'Your proposal "Community Garden Revamp" was not advanced',
    );
  });
});
