'use client';

import { useMediaQuery } from '@op/hooks';
import { AlignJustify } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

import { cn } from '../../lib/utils';
import { IconButton, IconButtonProps } from '../IconButton';

const SIDEBAR_WIDTH = '16rem';

type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  isOpenOnMobile: boolean;
  setIsOpenOnMobile: (open: boolean) => void;
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

interface SidebarProviderProps extends React.ComponentProps<'div'> {
  defaultOpen?: boolean;
  isOpen?: boolean;
  shortcut?: string;
  onOpenChange?: (open: boolean) => void;
}

const SidebarProvider = ({
  defaultOpen = false,
  isOpen: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) => {
  const [openMobile, setOpenMobile] = useState(false);

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

  const isMobile = useMediaQuery('(max-width: 640px)');

  // Restore sidebar state from localStorage on mount (desktop only)
  useEffect(() => {
    if (typeof window !== 'undefined' && !openProp && isMobile === false) {
      const storedValue = localStorage.getItem('sidebarOpen');
      if (storedValue !== null) {
        try {
          const parsedValue = JSON.parse(storedValue);
          setInternalOpenState(parsedValue);
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [isMobile, openProp]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && isMobile === false) {
      localStorage.setItem('sidebarOpen', JSON.stringify(open));
    }
  }, [open, isMobile]);

  // Helper to toggle the sidebar.
  const toggleSidebar = useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed';

  const contextValue = useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile: isMobile ?? false,
      isOpenOnMobile: openMobile,
      setIsOpenOnMobile: setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        className={cn('min-h-svh w-full', className)}
        {...props}
        suppressHydrationWarning
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};

interface SidebarProps extends React.ComponentProps<'div'> {
  side?: 'left' | 'right';
  label?: string;
}

const Sidebar = ({
  children,
  side = 'left',
  className,
  label,
}: SidebarProps) => {
  const { isMobile, state, isOpenOnMobile, setIsOpenOnMobile } = useSidebar();

  const MotionModalOverlay = motion(ModalOverlay);
  const MotionModal = motion(Modal);
  const transition = {
    duration: 0.3,
    ease: [0.65, 0.05, 0.36, 1.0],
  };

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpenOnMobile && (
          <MotionModalOverlay
            // force open state to ensure exit animation fires
            isOpen
            className={'fixed inset-0 bg-black/20 backdrop-blur'}
            onOpenChange={setIsOpenOnMobile}
            isDismissable
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition}
          >
            <MotionModal
              className={cn(
                'fixed top-0 h-full w-[--sidebar-width] bg-white',
              )}
              style={
                {
                  '--sidebar-width': SIDEBAR_WIDTH,
                } as React.CSSProperties
              }
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={transition}
            >
              <Dialog aria-label={label}>{children}</Dialog>
            </MotionModal>
          </MotionModalOverlay>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div
      data-state={state}
      data-side={side}
      data-slot="sidebar"
      className={cn(
        'group peer relative hidden overflow-hidden bg-white md:block',
      )}
    >
      <div
        data-slot="sidebar-gap"
        aria-hidden="true"
        className={cn(
          'w-[--sidebar-width] group-data-[state=collapsed]:w-0',
          'relative h-svh bg-transparent transition-[width] duration-200',
        )}
      />
      <div
        data-slot="sidebar-inner"
        className={cn(
          'absolute inset-0 flex size-full flex-col',
          'w-[--sidebar-width] transition-[left,right,width] duration-200',
          side === 'left'
            ? 'left-0 data-[state=collapsed]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 data-[state=collapsed]:right-[calc(var(--sidebar-width)*-1)]',
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
        'bg-background relative flex size-full flex-1 flex-col',
        'md:flex-row',
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
      <AlignJustify size={16} strokeWidth={1.5} />
    </IconButton>
  );
};

export type { SidebarContextProps, SidebarProviderProps, SidebarProps };

export { SidebarProvider, Sidebar, SidebarLayout, SidebarTrigger, useSidebar };
