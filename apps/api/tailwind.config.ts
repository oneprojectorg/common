import sharedConfig from '@op/ui/tailwind-config';
// @ts-ignore ignore undeclared types
import { withUITailwindPreset } from '@op/ui/tailwind-utils';

import type { Config } from 'tailwindcss';

const config: Pick<Config, 'content' | 'theme' | 'presets'> = {
  content: ['./app/**/*.tsx', './components/**/*.tsx'],
  presets: [sharedConfig],
};

export default withUITailwindPreset(config);
