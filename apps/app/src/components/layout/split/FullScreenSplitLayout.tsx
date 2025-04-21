export const FullScreenSplitLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div className="size-full">
        <div className="flex size-full max-h-full flex-col overflow-hidden">
          <div className="relative flex min-h-0 grow flex-col">
            <div className="size-full grid-cols-3 sm:grid">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
