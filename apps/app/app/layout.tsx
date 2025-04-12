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
  weight: '300',
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'A next-gen paradigm to co-create with AI.',
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

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" className="overflow-hidden scrollbar-none">
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
          className={`${roboto.variable} ${robotoMono.variable} ${robotoSerif.variable} ${inter.variable} overflow-x-hidden`}
        >
          <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
            <div className="size-full">
              <div className="flex size-full max-h-full flex-col overflow-hidden">
                <div className="relative flex min-h-0 grow flex-col">
                  {children}
                </div>
              </div>
            </div>
          </div>
          <Sonner
            theme="dark"
            position="bottom-center"
            className="toaster group"
            // closeButton
            // richColors
            pauseWhenPageIsHidden
            visibleToasts={10}
            toastOptions={{
              classNames: {
                toast:
                  'group toast bg-neutral-900/90 backdrop-blur-md border-none text-neutral-100 inset-shadow  mb-14',
                description: 'text-neutral-400',
                actionButton:
                  'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                cancelButton:
                  'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                closeButton:
                  'group-[.toast]:bg-neutral-900 group-[.toast]:hover:bg-neutral-600 group-[.toast]:duration-300 group-[.toast]:border-neutral-600 group-[.toast]:transition-all group-[.toast]:text-neutral-400 group-[.toast]:hover:text-neutral-950',
              },
            }}
          />
        </body>
      </TRPCProvider>
    </html>
  );
};

export default RootLayout;
