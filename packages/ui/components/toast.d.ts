/** The suite's undo-toast idiom (Design pass · Q4). See toast.js. */
export interface ToastOptions {
  text?: unknown;
  undo?: () => void;
  undoLabel?: string;
  duration?: number;
}
export interface ToastHandle { dismiss(): void }
export function toast(text: unknown, opts?: ToastOptions): ToastHandle;
export function toast(opts: ToastOptions): ToastHandle;
