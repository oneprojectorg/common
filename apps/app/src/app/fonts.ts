import { Noto_Sans_Arabic, Roboto, Roboto_Serif } from 'next/font/google';

// next/font fetches and self-hosts these at build time and injects their
// @font-face rules wherever this module is imported. The stack itself lives in
// @op/styles (tokens.css), composed by face name: next/font's `variable`
// output bundles each face with a metric-matched local fallback that has no
// unicode-range, which a two-script stack cannot order around. Reach for a
// `className` below only to put one face on an element in isolation.

export const roboto = Roboto({
  subsets: ['latin'],
  // Load the variable font (full wght axis) so font-strong's 450 renders true
  // instead of rounding up to the nearest static cut (500). next's Roboto type
  // only accepts 'variable' here, not a range string.
  weight: 'variable',
  display: 'swap',
});

export const robotoSerif = Roboto_Serif({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

// Fetched lazily the first time the browser needs one of its glyphs, so
// Latin-only pages never download it. Google ships Latin subsets of this face
// too, which is why the stack keeps Roboto ahead of it.
export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: 'variable',
  preload: false,
  display: 'swap',
});
