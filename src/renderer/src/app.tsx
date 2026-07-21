import React from 'react';
import { createRoot } from 'react-dom/client';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { PatternCanvas } from './components/PatternCanvas';
import { IconPicker } from './components/IconPicker';

function App() {
  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <PatternCanvas />
        <IconPicker />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
