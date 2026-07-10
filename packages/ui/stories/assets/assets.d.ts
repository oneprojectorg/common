// Storybook (vite) resolves static asset imports to URL strings.
declare module '*.png' {
  const src: string;
  export default src;
}
