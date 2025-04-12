export const FullScreenSplitAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="bg-aside-gradient sm:bg-teal absolute size-full flex-col sm:relative sm:flex sm:w-[40vw] sm:min-w-96">
      {children}
    </aside>
  );
};
