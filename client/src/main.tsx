import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import { queryClient } from '@/lib/queryClient';
import { registerSessionInterceptor } from '@/lib/sessionInterceptor';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip-checkbox';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ToasterHost } from '@/components/common/ToasterHost';
import '@/index.css';

// Installed before render so an expired session is handled from the first request.
registerSessionInterceptor();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root was not found.');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    {/* ThemeProvider is outermost: AuthProvider adopts the stored theme on sign-in. */}
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider delayDuration={200} skipDelayDuration={300}>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
              <ToasterHost />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
