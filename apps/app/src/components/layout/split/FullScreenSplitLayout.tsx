export const FullScreenSplitLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <div className="grid size-full grid-cols-3">{children}</div>;
};
