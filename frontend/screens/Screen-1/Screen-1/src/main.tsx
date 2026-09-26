import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// prettier-ignore
import Screen1 from "./Screen-1.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Screen1 />} />
        <Route path="/screen-1" element={<Screen1 />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
