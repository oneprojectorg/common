export const FullScreenSplitMain = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <main className="flex size-full flex-col p-4 sm:p-8">{children}</main>;
};
