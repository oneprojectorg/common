import { TRPCProvider } from '@op/api/client';
import { createTRPCNextClient } from '@op/api/next';
import { APP_NAME, printNFO } from '@op/core';
import { Toast } from '@op/ui/Toast';
import '@op/ui/tailwind-styles';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto, Roboto_Mono, Roboto_Serif } from 'next/font/google';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { PostHogProvider } from '../components/PostHogProvider';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
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

// const { IS_DEVELOPMENT, IS_PREVIEW } = OPURLConfig('APP');

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const trpcNext = await createTRPCNextClient();
  const user = await trpcNext.account.getMyAccount.query();

  if (!user?.organizationUsers?.length) {
    redirect('/start');
  }

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
          className={`${roboto.variable} ${robotoMono.variable} ${robotoSerif.variable} ${inter.variable} overflow-x-hidden text-base text-neutral-black antialiased`}
        >
          <PostHogProvider>{children}</PostHogProvider>
          <ReactQueryDevtools initialIsOpen={false} />
          <Toast />
        </body>
      </TRPCProvider>
    </html>
  );
};

export default RootLayout;
