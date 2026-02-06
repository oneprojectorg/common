'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, use, useCallback, useMemo, useState } from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';
import { LuAlignJustify } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { IconButton, IconButtonProps } from '../IconButton';

// Tailwind v4 default sm breakpoint (640px)
const SM_BREAKPOINT = screens.sm;

type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextProps | null>(null);

const useSidebar = () => {
  const context = use(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return context;
};

const SidebarProvider = ({
  defaultOpen = false,
  isOpen: openProp,
  onOpenChange: setOpenProp,
  children,
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  isOpen?: boolean;
  shortcut?: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [internalOpenState, setInternalOpenState] = useState(defaultOpen);
  const open = openProp ?? internalOpenState;
  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        setInternalOpenState(openState);
      }
    },
    [setOpenProp, open],
  );

  const isMobile = useMediaQuery(`(max-width: ${SM_BREAKPOINT})`);

  // Helper to toggle the sidebar.
  const toggleSidebar = useCallback(() => {
    setOpen((open) => !open);
  }, [setOpen]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed';

  const contextValue = useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile: isMobile ?? false,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};

const Sidebar = ({
  children,
  side = 'left',
  className,
  label,
  mobileOnly = false,
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  label?: string;
  mobileOnly?: boolean;
}) => {
  const { isMobile, state, open, setOpen } = useSidebar();

  const MotionModalOverlay = motion(ModalOverlay);
  const MotionModal = motion(Modal);
  const transition = {
    duration: 0.3,
    ease: [0.65, 0.05, 0.36, 1.0],
  };

  if (isMobile) {
    const isRight = side === 'right';
    return (
      <AnimatePresence>
        {open && (
          <MotionModalOverlay
            // force open state to ensure exit animation fires
            isOpen
            className={'fixed inset-0 z-50 bg-neutral-black/20 backdrop-blur'}
            onOpenChange={setOpen}
            isDismissable
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition}
          >
            <MotionModal
              className={cn(
                'fixed top-0 h-full w-64 bg-white',
                isRight ? 'right-0' : 'left-0',
              )}
              initial={{ x: isRight ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRight ? '100%' : '-100%' }}
              transition={transition}
            >
              <Dialog aria-label={label}>{children}</Dialog>
            </MotionModal>
          </MotionModalOverlay>
        )}
      </AnimatePresence>
    );
  }

  // Don't render desktop sidebar when mobileOnly is true
  if (mobileOnly) {
    return null;
  }

  return (
    <div
      data-state={state}
      data-side={side}
      data-slot="sidebar"
      className="group peer sticky top-0 hidden min-w-fit overflow-hidden bg-white sm:block"
    >
      <div
        data-slot="sidebar-gap"
        aria-hidden="true"
        className={cn(
          'w-64 group-data-[state=collapsed]:w-0',
          'relative h-svh bg-transparent transition-[width] duration-200',
        )}
      />
      <div
        data-slot="sidebar-inner"
        className={cn(
          'absolute inset-0 flex size-full flex-col',
          'w-64 transition-[left,right,width] duration-200',
          side === 'left'
            ? 'left-0 data-[state=collapsed]:-left-64'
            : 'right-0 data-[state=collapsed]:-right-64',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};

const SidebarLayout = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="sidebar-layout"
      className={cn(
        'bg-background relative flex size-full flex-1 flex-col overflow-y-auto',
        'sm:flex-row',
        className,
      )}
      {...props}
    />
  );
};

const SidebarTrigger = ({
  className,
  ...props
}: Omit<IconButtonProps, 'children' | 'onPress'>) => {
  const { toggleSidebar } = useSidebar();
  return (
    <IconButton onPress={toggleSidebar} className={className} {...props}>
      <LuAlignJustify className="size-4" />
    </IconButton>
  );
};

export { SidebarProvider, Sidebar, SidebarLayout, SidebarTrigger, useSidebar };
