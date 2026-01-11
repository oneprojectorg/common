import { Header2 } from '@op/ui/Header';

import { SideImage } from './assets/SideImage';

export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="lg:bg-teal bg-gradient text-offWhite relative right-0 top-0 -z-10 hidden size-full h-screen flex-col items-center justify-center lg:sticky lg:z-10 lg:col-span-1 lg:flex lg:min-w-96">
      <div className="bg-gradient absolute h-full w-full">
        <img
          src="/topLeft.png"
          alt="Top Left Decoration"
          className="absolute left-0 top-0 z-0"
        />
        <img
          src="/bottomRight.png"
          alt="Bottom Right Decoration"
          className="absolute bottom-0 right-0 z-0"
        />
        <div
          className="h-full w-full bg-repeat opacity-25 mix-blend-screen"
          style={{ backgroundImage: 'url(/noise.png)' }}
        />
      </div>
      <div className="text-offWhite absolute right-0 top-0 -z-10 hidden size-full justify-center p-4 lg:z-10 lg:flex lg:flex-col lg:items-center">
        <div className="flex flex-col items-center justify-center gap-4 px-12">
          <h1 className="text-title-xxl min-w-96 text-center font-serif font-light leading-[3.3rem] tracking-[-0.075rem]">
            A bridge to the
            <br />
            <i>new economy.</i>
          </h1>
          <SideImage className="w-full" />
          <div className="text-offWhite flex w-full max-w-80 flex-col items-center justify-center gap-4">
            <Header2 className="text-title-md text-center font-serif">
              Connect with your network.
            </Header2>
            <span className="text-center text-base leading-[150%]">
              Reinforce your real-world relationships and share resources for
              the benefit of all.
            </span>
          </div>
        </div>
        {children}
      </div>
    </aside>
  );
};
