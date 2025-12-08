import { TRPCProvider } from '@op/api/client';
import { getSSRCookies } from '@op/api/ssrCookies';
import { APP_NAME, printNFO } from '@op/core';
import { WebVitals } from '@op/logging';
import { Toast } from '@op/ui/Toast';
import '@op/ui/tailwind-styles';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { Metadata, Viewport } from 'next';
import { Roboto, Roboto_Mono, Roboto_Serif } from 'next/font/google';
import Script from 'next/script';

import { IconProvider } from '../components/IconProvider';
import { PostHogProvider } from '../components/PostHogProvider';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-sans',
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-mono',
  display: 'swap',
});

const robotoSerif = Roboto_Serif({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
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

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const ssrCookies = await getSSRCookies();

  return (
    <html className="h-full">
      <head>
        <Script id="nfo-script" strategy="beforeInteractive">
          {printNFO()}
        </Script>
      </head>
      <WebVitals />
      <TRPCProvider ssrCookies={ssrCookies}>
        <body
          className={`${roboto.variable} ${robotoMono.variable} ${robotoSerif.variable} h-full overflow-x-hidden text-base text-neutral-black antialiased`}
        >
          <PostHogProvider>
            <IconProvider>{children}</IconProvider>
          </PostHogProvider>
          <ReactQueryDevtools initialIsOpen={false} />
          <Toast />
        </body>
      </TRPCProvider>
    </html>
  );
};

export default RootLayout;
