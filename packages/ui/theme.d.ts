export type ThemeChoice = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

export function getTheme(): ThemeChoice;
export function setTheme(theme: ThemeChoice): void;
export function resolvedTheme(): ResolvedTheme;
export function toggleTheme(): ResolvedTheme;
export function initTheme(): void;
