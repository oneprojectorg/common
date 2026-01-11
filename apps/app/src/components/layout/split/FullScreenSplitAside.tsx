import { Header2 } from '@op/ui/Header';

import { SideImage } from './assets/SideImage';

export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="lg:bg-teal right-0 top-0 lg:sticky lg:z-10 lg:col-span-1 lg:flex lg:min-w-96 relative -z-10 hidden size-full h-screen flex-col items-center justify-center bg-gradient text-offWhite">
      <div className="absolute h-full w-full bg-gradient">
        <img
          src="/topLeft.png"
          alt="Top Left Decoration"
          className="left-0 top-0 absolute z-0"
        />
        <img
          src="/bottomRight.png"
          alt="Bottom Right Decoration"
          className="bottom-0 right-0 absolute z-0"
        />
        <div
          className="h-full w-full bg-repeat opacity-25 mix-blend-screen"
          style={{ backgroundImage: 'url(/noise.png)' }}
        />
      </div>
      <div className="right-0 top-0 p-4 lg:z-10 lg:flex lg:flex-col lg:items-center absolute -z-10 hidden size-full justify-center text-offWhite">
        <div className="gap-4 px-12 flex flex-col items-center justify-center">
          <h1 className="min-w-96 font-light text-center font-serif text-title-xxl leading-[3.3rem] tracking-[-0.075rem]">
            A bridge to the
            <br />
            <i>new economy.</i>
          </h1>
          <SideImage className="w-full" />
          <div className="max-w-80 gap-4 flex w-full flex-col items-center justify-center text-offWhite">
            <Header2 className="text-center font-serif text-title-md">
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
