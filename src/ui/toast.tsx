import CheckCircleIcon from '@material-symbols/svg-400/rounded/check_circle.svg?react';
import CloseIcon from '@material-symbols/svg-400/rounded/close.svg?react';
import ErrorIcon from '@material-symbols/svg-400/rounded/error.svg?react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { cn } from './cn';
import { Icon } from './icon';
import { useOverlayMotion } from './overlay-motion';

export interface ToastOptions {
  kind: 'positive' | 'negative';
  title: string;
  description?: string;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

/** Shows a toast: `surface` with a `line` border; an icon and colour tell its kind. */
export function useToast(): (toast: ToastOptions) => void {
  return use(ToastContext);
}

let nextId = 0;

export function Toaster({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const show = useCallback((toast: ToastOptions) => {
    nextId += 1;
    setToasts((current) => [...current, { ...toast, id: nextId }]);
  }, []);
  const remove = (id: number) => setToasts((current) => current.filter((item) => item.id !== id));

  return (
    <ToastPrimitive.Provider duration={5000} label={t('ui.notifications')}>
      <ToastContext value={show}>{children}</ToastContext>
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
        ))}
      </AnimatePresence>
      <ToastPrimitive.Viewport className="fixed bottom-4 left-1/2 z-50 m-0 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 list-none flex-col gap-2 p-0 outline-none" />
    </ToastPrimitive.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const { t } = useTranslation();
  const overlayMotion = useOverlayMotion();
  return (
    <ToastPrimitive.Root
      forceMount
      asChild
      type={toast.kind === 'negative' ? 'foreground' : 'background'}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <motion.li
        className="flex items-start gap-3 rounded-card border border-line bg-surface p-3 text-text shadow-overlay"
        {...overlayMotion}
      >
        <Icon
          icon={toast.kind === 'negative' ? ErrorIcon : CheckCircleIcon}
          className={cn('mt-0.5', toast.kind === 'negative' ? 'text-negative' : 'text-positive')}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <ToastPrimitive.Title className="font-semibold">{toast.title}</ToastPrimitive.Title>
          {toast.description && (
            <ToastPrimitive.Description className="text-sm text-muted">
              {toast.description}
            </ToastPrimitive.Description>
          )}
        </div>
        <ToastPrimitive.Close asChild>
          <Button variant="ghost" size="icon" aria-label={t('ui.close')} className="-my-1">
            <Icon icon={CloseIcon} size={20} />
          </Button>
        </ToastPrimitive.Close>
      </motion.li>
    </ToastPrimitive.Root>
  );
}
