import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components/panel.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
