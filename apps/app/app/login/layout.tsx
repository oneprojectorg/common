import '@op/ui/tailwind-styles';

import { Inter, Roboto, Roboto_Mono, Roboto_Serif } from 'next/font/google';
import Script from 'next/script';
import { Toaster as Sonner } from 'sonner';

import { APP_NAME, printNFO } from '@op/core';
import { TRPCProvider } from '@op/trpc/client';

import type { Metadata, Viewport } from 'next';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-sans',
});

const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-mono',
});

const robotoSerif = Roboto_Serif({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Common.',
  icons: {
    icon: [{ url: '/op.png', type: 'image/png' }],
  },
  robots: {
    googleBot: {
      index: false,
      follow: false,
    },
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  height: 'device-height',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// const { IS_DEVELOPMENT, IS_PREVIEW } = OPURLConfig('APP');

const LoginLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div className="size-full">
        <div className="flex size-full max-h-full flex-col overflow-hidden">
          <div className="relative flex min-h-0 grow flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default LoinLayout;
