export const FullScreenSplitLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <div className="size-full grid-cols-3 sm:grid">{children}</div>;
};
