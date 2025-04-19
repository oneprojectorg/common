export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="absolute size-full flex-col bg-gradient sm:relative sm:flex sm:w-[40vw] sm:min-w-96 sm:bg-teal">
      {children}
    </aside>
  );
};
