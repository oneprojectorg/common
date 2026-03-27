import { Header1 } from '@op/ui/Header';
import { ReactNode } from 'react';

export const OnboardingCenterLayout = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) => {
  return (
    <div className="flex h-[calc(100dvh-80px)] w-full items-center justify-center">
      <div className="flex w-full max-w-[472px] flex-col items-center gap-8 px-4 sm:px-0">
        <div className="flex flex-col gap-2 text-center">
          <Header1 className="text-neutral-black">{title}</Header1>
          <p className="text-sm leading-normal text-neutral-gray4">
            {subtitle}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
};
