'use client';

import { screens } from '@op/styles/constants';
import {
  type ComponentProps,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LuAlignJustify } from 'react-icons/lu';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(query);
    const update = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [query]);

  return matches;
}

import { IconButton, type IconButtonProps } from '../IconButton';
import { Sheet, SheetBody, SheetHeader } from '../Sheet';
import { cn } from '../../lib/utils';

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
}: ComponentProps<'div'> & {
  defaultOpen?: boolean;
  isOpen?: boolean;
  shortcut?: string;
  onOpenChange?: (open: boolean) => void;
}) => {
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

  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

  const toggleSidebar = useCallback(() => {
    setOpen((open) => !open);
  }, [setOpen]);

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
}: ComponentProps<'div'> & {
  side?: 'left' | 'right';
  label?: string;
  mobileOnly?: boolean;
}) => {
  const { isMobile, state, open, setOpen } = useSidebar();

  if (isMobile) {
    return (
      <Sheet
        isOpen={open}
        onOpenChange={setOpen}
        side={side}
        className={cn('w-64 p-0', className)}
      >
        {label && <SheetHeader>{label}</SheetHeader>}
        <SheetBody>{children}</SheetBody>
      </Sheet>
    );
  }

  if (mobileOnly) {
    return null;
  }

  return (
    <div
      data-state={state}
      data-side={side}
      data-slot="sidebar"
      className="group peer sticky top-0 hidden min-w-fit overflow-hidden bg-background sm:block"
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

const SidebarLayout = ({ className, ...props }: ComponentProps<'div'>) => {
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

type SidebarTriggerProps = Omit<
  IconButtonProps,
  'children' | 'onPress' | 'onClick'
>;

const SidebarTrigger = ({ className, ...props }: SidebarTriggerProps) => {
  const { toggleSidebar } = useSidebar();
  return (
    <IconButton onPress={toggleSidebar} className={className} {...props}>
      <LuAlignJustify className="size-4" />
    </IconButton>
  );
};

export { SidebarProvider, Sidebar, SidebarLayout, SidebarTrigger, useSidebar };
