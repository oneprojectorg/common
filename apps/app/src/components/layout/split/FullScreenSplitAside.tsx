'use client';

import { Header2 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

import { SideImage } from './assets/SideImage';

export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  const t = useTranslations();
  return (
    <aside className="relative top-0 right-0 -z-10 hidden size-full h-screen flex-col items-center justify-center bg-gradient text-offWhite lg:sticky lg:z-10 lg:col-span-1 lg:flex lg:min-w-96 lg:bg-teal">
      <div className="absolute h-full w-full bg-gradient">
        <img
          src="/topLeft.png"
          alt="Top Left Decoration"
          className="absolute top-0 left-0 z-0"
        />
        <img
          src="/bottomRight.png"
          alt="Bottom Right Decoration"
          className="absolute right-0 bottom-0 z-0"
        />
        <div
          className="h-full w-full bg-repeat opacity-25 mix-blend-screen"
          style={{ backgroundImage: 'url(/noise.png)' }}
        />
      </div>
      <div className="absolute top-0 right-0 -z-10 hidden size-full justify-center p-4 text-offWhite lg:z-10 lg:flex lg:flex-col lg:items-center">
        <div className="flex flex-col items-center justify-center gap-4 px-12">
          <h1 className="min-w-96 text-center font-serif text-title-xxl leading-[3.3rem] font-light tracking-[-0.075rem]">
            {t('A bridge to the')}
            <br />
            <i>{t('new economy.')}</i>
          </h1>
          <SideImage className="w-full" />
          <div className="flex w-full max-w-80 flex-col items-center justify-center gap-4 text-offWhite">
            <Header2 className="text-center font-serif text-title-md">
              {t('Connect with your network.')}
            </Header2>
            <span className="text-center text-base leading-[150%]">
              {t(
                'Reinforce your real-world relationships and share resources for the benefit of all.',
              )}
            </span>
          </div>
        </div>
        {children}
      </div>
    </aside>
  );
};
