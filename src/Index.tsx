import React from 'react';
import App from './App.tsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Index: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Index;
