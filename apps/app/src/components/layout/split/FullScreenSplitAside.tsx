import { Header2 } from '@/components/Header';

import { SideImage } from './assets/SideImage';

export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="absolute right-0 top-0 -z-10 hidden size-full h-screen flex-col items-center justify-center bg-gradient text-offWhite sm:fixed sm:z-10 sm:w-1/3 sm:min-w-96 sm:bg-teal lg:flex">
      <div className="absolute h-full w-full bg-gradient">
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
      </div>
      <div className="absolute right-0 top-0 -z-10 hidden size-full h-screen flex-col items-center justify-center text-offWhite sm:fixed sm:z-10 sm:w-1/3 sm:min-w-96 lg:flex">
        <div className="flex flex-col items-center justify-center gap-4 px-12">
          <h1 className="min-w-96 text-center font-serif text-5xl font-light leading-[3.3rem] tracking-[-0.075rem]">
            A bridge to the
            <br />
            <i>new economy.</i>
          </h1>
          <SideImage className="w-full" />
          <div className="flex flex-col items-center justify-center gap-4">
            <Header2 className="text-center font-serif text-2xl font-light tracking-[-0.0225rem] text-offWhite">
              Connect with your network.
            </Header2>
            <span className="text-center text-base leading-[150%] text-offWhite">
              Reinforce your real-world relationships and share resources
              <br />
              for the benefit of all.
            </span>
          </div>
        </div>
        {children}
      </div>
    </aside>
  );
};
