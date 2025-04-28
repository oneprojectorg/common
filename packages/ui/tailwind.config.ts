import type { Config } from 'tailwindcss';

import sharedConfig from './tailwind.shared';

const config: Pick<Config, 'prefix' | 'presets' | 'content'> = {
  content: ['./src/**/*.tsx', './stories/**/*.tsx'],
  presets: [sharedConfig],
};

export default config;
