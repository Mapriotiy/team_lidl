import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// prettier-ignore
import Screen3 from "./Screen-3.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Screen3 />} />
        <Route path="/screen-3" element={<Screen3 />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
