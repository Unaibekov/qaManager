import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './styles/sidebar.css';
import './styles/dashboard.css';
import './styles/catalog.css';
import './styles/regressions.css';
import './styles/modals.css';
import './styles/transfer.css';
import './styles/responsive.css';
import './styles/animations.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
