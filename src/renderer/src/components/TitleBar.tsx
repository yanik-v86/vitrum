import React from 'react';

export function TitleBar() {
  return (
    <div className="titlebar">
      <span className="titlebar-title">Pattern Glass</span>
      <div className="titlebar-controls">
        <button className="titlebar-btn minimize" onClick={() => window.electronAPI.minimize()} />
        <button className="titlebar-btn maximize" onClick={() => window.electronAPI.maximize()} />
        <button className="titlebar-btn close" onClick={() => window.electronAPI.close()} />
      </div>
    </div>
  );
}
