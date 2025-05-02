import { APP_NAME, printNFO } from '@op/core';
import { TRPCProvider } from '@op/trpc/client';
import { Toast } from '@op/ui/Toast';
import '@op/ui/tailwind-styles';
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto, Roboto_Mono, Roboto_Serif } from 'next/font/google';
import Script from 'next/script';

import { PostHogProvider } from '../components/PostHogProvider';

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

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        {/* {(IS_DEVELOPMENT || IS_PREVIEW) && (
          <script
            defer
            crossOrigin="anonymous"
            src="//unpkg.com/react-scan/dist/auto.global.js"
          />
        )} */}
        <Script id="nfo-script" strategy="beforeInteractive">
          {printNFO()}
        </Script>
      </head>
      <TRPCProvider>
        <body
          className={`${roboto.variable} ${robotoMono.variable} ${robotoSerif.variable} ${inter.variable} overflow-x-hidden text-base text-neutral-black`}
        >
          <PostHogProvider>{children}</PostHogProvider>
          <Toast />
        </body>
      </TRPCProvider>
    </html>
  );
};

export default RootLayout;
