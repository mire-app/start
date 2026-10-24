import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Table that scrolls horizontally inside its own box, never the page (375 px). */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return <caption className={cn('pb-2 text-left text-muted', className)} {...props} />;
}

export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-line last:border-b-0', className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn('h-10 px-3 text-left align-middle font-semibold text-muted', className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}
