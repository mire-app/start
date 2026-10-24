import CloseIcon from '@material-symbols/svg-400/rounded/close.svg?react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, use, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { cn } from './cn';
import { Icon } from './icon';
import { fadeMotion, useOverlayMotion } from './overlay-motion';

// The content needs the open state to animate its exit with AnimatePresence.
const OpenContext = createContext(false);

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  }
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <OpenContext value={open}>{children}</OpenContext>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const open = use(OpenContext);
  const { t } = useTranslation();
  const overlayMotion = useOverlayMotion();
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div className="fixed inset-0 z-40 bg-top/60" {...fadeMotion} />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content forceMount asChild>
            <motion.div
              className={cn(
                'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-card border border-line bg-surface p-6 text-text shadow-overlay',
                className,
              )}
              {...overlayMotion}
            >
              {children}
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('ui.close')}
                  className="absolute top-2 right-2"
                >
                  <Icon icon={CloseIcon} />
                </Button>
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn('pr-10 text-xl font-semibold', className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-muted', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap justify-end gap-2 pt-2', className)} {...props} />;
}
