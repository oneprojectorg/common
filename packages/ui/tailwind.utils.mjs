const packagesUsingTailwind = {
  '@op/ui': '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
};

export const withUITailwindPreset = (
  /** @type {Pick<import('tailwindcss').Config, "content" | "presets">} */
  config,
) => {
  return {
    ...config,
    content: [...config.content, ...Object.values(packagesUsingTailwind)],
  };
};

export const withTranspiledWorkspacesForNext = (
  /** @type {import('next').NextConfig} */
  config,
) => {
  return {
    ...config,
    transpilePackages: [
      ...(config.transpilePackages || []),
      ...Object.keys(packagesUsingTailwind),
    ],
    experimental: {
      ...(config.experimental || {}),
      optimizePackageImports: Object.keys(packagesUsingTailwind),
    },
  };
};
