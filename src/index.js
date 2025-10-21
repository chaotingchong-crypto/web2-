import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AItest from './AItest';
import reportWebVitals from './reportWebVitals';

// 對應 HTML 中的 <div id="react-root"></div>
const el = document.getElementById('react-root');

if (el) {
  const root = createRoot(el);
  root.render(
    <React.StrictMode>
      <AItest />
    </React.StrictMode>
  );
} else {
  console.error('⚠️ 找不到 #react-root，請確認它在 HTML 中有被正確加入');
}

reportWebVitals();
