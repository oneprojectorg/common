import { createRoot } from 'react-dom/client';

import { App } from './App';

import './styles.css';

/*
 * The product ships one palette, and `@op/sense` keys its dark variants off an
 * ancestor attribute. A host that stamps dark on the document would flip the
 * components while the tokens stayed light, so the page pins itself instead of
 * rendering half of each.
 */
document.documentElement.classList.remove('dark');
document.documentElement.setAttribute('data-theme', 'light');

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<App />);
}
