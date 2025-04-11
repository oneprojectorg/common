export const FullScreenStepperAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="bg-background-gradient sm:bg-primary sm:bg-aside-gradient absolute size-full flex-col sm:relative sm:flex sm:w-[40vw] sm:min-w-96">
      {children}
    </aside>
  );
};
