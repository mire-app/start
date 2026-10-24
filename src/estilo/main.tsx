// Style guide entry (estilo.html, SPEC-0003 §10): same i18n, theme and styles as the app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/design/styles';
import '@/i18n';
import { Toaster } from '@/ui/toast';
import { TooltipProvider } from '@/ui/tooltip';
import StyleGuide from './StyleGuide';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <Toaster>
        <StyleGuide />
      </Toaster>
    </TooltipProvider>
  </StrictMode>,
);
