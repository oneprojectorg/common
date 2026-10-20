import { Noto_Sans_Arabic, Roboto, Roboto_Serif } from 'next/font/google';

// Declares the @font-face rules only; the stack is composed by face name in @op/styles.
// Exported because next/font needs a const binding and noUnusedLocals rejects an unread one.

export const roboto = Roboto({
  subsets: ['latin'],
  // Variable font so font-strong's 450 renders true instead of rounding to 500.
  weight: 'variable',
  display: 'swap',
});

export const robotoSerif = Roboto_Serif({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: 'variable',
  // Not preloaded so Latin-only pages never download it; Arabic pages swap in.
  preload: false,
  display: 'swap',
});
