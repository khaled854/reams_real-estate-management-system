import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { I18nProvider } from './i18n';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      I18nProvider wraps everything so every component can call useI18n().
      It reads the stored language from localStorage on mount and sets
      document.documentElement.lang / dir accordingly — this is what
      drives RTL layout and the Arabic font override in index.css.
    */}
    <I18nProvider>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
            },
          }}
        />
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>
);
