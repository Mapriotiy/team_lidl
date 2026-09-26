import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// prettier-ignore
import Screen5 from "./Screen-5.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Screen5 />} />
        <Route path="/screen-5" element={<Screen5 />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
