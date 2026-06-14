export function esConfirm(message: string, opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean; title?: string }): Promise<boolean>;
export function esAlert(message: string, opts?: { okLabel?: string; title?: string }): Promise<void>;
