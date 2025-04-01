import sharedConfig from './tailwind.shared';

import type { Config } from 'tailwindcss';

const config: Pick<Config, 'prefix' | 'presets' | 'content'> = {
  content: ['./src/**/*.tsx', './stories/**/*.tsx'],
  presets: [sharedConfig],
};

export default config;
