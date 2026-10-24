import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, use, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from './cn';
import { useOverlayMotion } from './overlay-motion';

// The content needs the open state to animate its exit with AnimatePresence.
const OpenContext = createContext(false);

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    // Not modal: a modal menu sets aria-hidden on the page behind it, which axe reports
    // (aria-hidden-focus). Focus still moves into the menu and Escape or a click outside close it.
    <MenuPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <OpenContext value={open}>{children}</OpenContext>
    </MenuPrimitive.Root>
  );
}

export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  children,
  align = 'end',
}: {
  className?: string;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const open = use(OpenContext);
  const overlayMotion = useOverlayMotion();
  return (
    <AnimatePresence>
      {open && (
        <MenuPrimitive.Portal forceMount>
          <MenuPrimitive.Content forceMount asChild align={align} sideOffset={4}>
            <motion.div
              className={cn(
                'z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-control border border-line bg-surface p-1 text-text shadow-overlay',
                className,
              )}
              {...overlayMotion}
            >
              {children}
            </motion.div>
          </MenuPrimitive.Content>
        </MenuPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex h-11 cursor-pointer items-center gap-3 rounded-[6px] px-3 text-base outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-track',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('my-1 h-px bg-line', className)} {...props} />;
}
