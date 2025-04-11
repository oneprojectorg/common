export const FullScreenStepperAside = ({
  children = null,
}: {
  children?: React.ReactNode;
}) => {
  return (
    <aside className="absolute size-full flex-col bg-background-gradient sm:relative sm:flex sm:w-1/3 sm:min-w-96 sm:bg-stepper-gradient">
      {children}
    </aside>
  );
};
