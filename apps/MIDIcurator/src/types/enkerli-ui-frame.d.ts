/**
 * Loose ambient types for the shared-frame chrome (@enkerli/ui ships
 * untyped, framework-agnostic JS — the create*(host, opts) idiom).
 */

declare module '@enkerli/ui/global-cluster' {
  export const DIN5_SVG: string;
  export function createGlobalCluster(
    host: Element,
    opts?: any,
  ): { root: HTMLElement; update(next?: any): void; destroy(): void };
}

declare module '@enkerli/ui/library-drawer' {
  export function createTwoTapDelete(opts: { name: string; onDelete: () => void }): HTMLElement;
  export function createLibraryDrawer(
    host: Element,
    opts: any,
  ): { root: HTMLElement; update(next?: any): void; destroy(): void };
}
