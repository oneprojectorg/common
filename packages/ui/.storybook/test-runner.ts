import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';
import { checkA11y, configureAxe, injectAxe } from 'axe-playwright';

// Match WCAG tags used by tests/e2e/tests/a11y-baseline.spec.ts so component
// and page violations report against the same rule set.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page, context) {
    const storyContext = await getStoryContext(page, context);
    const a11yParams = storyContext.parameters?.a11y;

    if (a11yParams?.disable) {
      return;
    }

    await configureAxe(page, {
      rules: a11yParams?.config?.rules,
    });

    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: WCAG_TAGS,
        },
      },
    });
  },
};

export default config;
