import { Toaster } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Toast host (Section 32).
 *
 * Rendered once at the root so every screen's notifications appear in the same
 * place, and themed to match — a light toast on a dark page is unreadable.
 */
export function ToasterHost() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme}
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-border',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
