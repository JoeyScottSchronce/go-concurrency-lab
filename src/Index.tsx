import React from 'react';
import App from './App.tsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Index: React.FC = () => {
  const baseUrl = import.meta.env.BASE_URL;
  const basename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/go-concurrency-lab" element={<App />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Index;
