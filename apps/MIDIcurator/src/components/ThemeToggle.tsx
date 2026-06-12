import { useState } from 'react';
import { initTheme, resolvedTheme, toggleTheme } from '@enkerli/ui/theme';

/**
 * Dark/Light theme toggle — the suite's shared theme machinery
 * (@enkerli/ui/theme): light is the default design target, the OS
 * preference applies until a choice is made, choices persist, and
 * data-theme on <html> drives the paper & ink tokens.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    initTheme();
    return resolvedTheme();
  });

  const toggle = () => setTheme(toggleTheme());

  return (
    <button
      className="mc-theme-toggle"
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
