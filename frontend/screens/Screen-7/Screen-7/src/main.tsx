import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// prettier-ignore
import Screen7 from "./Screen-7.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Screen7 />} />
        <Route path="/screen-7" element={<Screen7 />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
