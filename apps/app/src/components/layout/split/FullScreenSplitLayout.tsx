export const FullScreenSplitLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div className="md:grid md:grid-cols-2 lg:grid-cols-3 relative flex size-full">
        {children}
      </div>
    </div>
  );
};
