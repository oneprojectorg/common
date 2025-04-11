export const FullScreenSplitLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <div className="bg-background flex size-full">{children}</div>;
};
