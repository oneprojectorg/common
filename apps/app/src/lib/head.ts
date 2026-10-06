import { APP_NAME } from '@op/core';

/** A page's `<title>` meta entry, in the site-wide `Page | Common` pattern. */
export const pageTitle = (title: string) => ({
  title: `${title} | ${APP_NAME}`,
});
