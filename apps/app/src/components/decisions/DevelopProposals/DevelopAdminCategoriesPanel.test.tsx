// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { DevelopAdminCategoriesPanel } from './DevelopAdminCategoriesPanel';

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      listCategoryReviewerStatus: {
        useSuspenseQuery: () => [
          {
            items: [
              {
                category: { id: 'parks', name: 'Parks', termUri: 'parks' },
                reviewers: [],
                sourceCount: 3,
                advancingCount: 1,
              },
            ],
          },
        ],
      },
    },
  },
}));

afterEach(cleanup);

describe('DevelopAdminCategoriesPanel', () => {
  it('opens the page of the category whose name is clicked', () => {
    const onOpenCategory = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DevelopAdminCategoriesPanel
          processInstanceId="instance"
          onOpenCategory={onOpenCategory}
        />
      </NextIntlClientProvider>,
    );

    screen.getByRole('button', { name: 'Parks' }).click();

    expect(onOpenCategory).toHaveBeenCalledWith('parks');
  });
});
