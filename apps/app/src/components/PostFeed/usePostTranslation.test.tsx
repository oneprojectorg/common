// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TranslateLink } from '@/components/decisions/TranslateLink';

import en from '../../lib/i18n/dictionaries/en.json';
import { usePostTranslation } from './usePostTranslation';

const { translatePost } = vi.hoisted(() => ({
  translatePost: vi.fn<
    (input: { postId: string; targetLocale: string }) => Promise<{
      content?: string;
    }>
  >(),
}));

vi.mock('@op/api/client', () => ({
  trpc: {
    translation: {
      translatePost: { useMutation: () => ({ mutateAsync: translatePost }) },
    },
  },
}));

const ES =
  'Proponemos construir una huerta comunitaria en el parque central del barrio para que las familias tengan alimentos frescos.';
const EN =
  'We are hosting a community garden workday in the central park this weekend.';

const Post = ({ postId, content }: { postId: string; content: string }) => {
  const translation = usePostTranslation({ postId, content });
  return (
    <article>
      <TranslateLink translation={translation} />
      <p>{translation.translation ?? content}</p>
    </article>
  );
};

afterEach(() => {
  cleanup();
  translatePost.mockReset();
});

describe('usePostTranslation', () => {
  it('offers no link on a post already in the reader’s language', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Post postId="post-en" content={EN} />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole('button', { name: 'See translation' })).toBe(
      null,
    );
  });

  it('translates only the post whose link was clicked', async () => {
    translatePost.mockResolvedValue({ content: 'Translated post.' });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Post postId="post-es-1" content={ES} />
        <Post postId="post-es-2" content={ES} />
      </NextIntlClientProvider>,
    );

    const [firstLink] = screen.getAllByRole('button', {
      name: 'See translation',
    });
    if (!firstLink) {
      throw new Error('Expected a translate link on each Spanish post');
    }
    await act(async () => {
      await userEvent.setup().click(firstLink);
    });

    expect(translatePost).toHaveBeenCalledTimes(1);
    expect(translatePost).toHaveBeenCalledWith({
      postId: 'post-es-1',
      targetLocale: 'en',
    });
    expect(screen.getByText('Translated post.')).toBeTruthy();
    expect(screen.getByText(ES)).toBeTruthy();
  });
});
