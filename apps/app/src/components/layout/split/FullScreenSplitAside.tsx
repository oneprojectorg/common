import { Header2 } from '@/components/Header';

import { SideImage } from './assets/SideImage';

export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="fixed right-0 top-0 size-full h-screen w-auto flex-col items-center justify-center bg-gradient text-offWhite sm:flex sm:bg-teal">
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
    </aside>
  );
};
