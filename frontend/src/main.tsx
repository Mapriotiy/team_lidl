import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WorkspaceProvider } from "./workspace";
import { Overview } from "./routes/Overview";
import { Leads } from "./routes/Leads";
import { LeadDetail } from "./routes/LeadDetail";
import { Signals } from "./routes/Signals";
import { Icp } from "./routes/Icp";
import { Sources } from "./routes/Sources";
import { Outreach } from "./routes/Outreach";
import { Reports } from "./routes/Reports";
import { Settings } from "./routes/Settings";
import { NotFound } from "./routes/NotFound";

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Overview /> },
      { path: "/leads", element: <Leads /> },
      { path: "/leads/:companyId", element: <LeadDetail /> },
      { path: "/signals", element: <Signals /> },
      { path: "/icp", element: <Icp /> },
      { path: "/sources", element: <Sources /> },
      { path: "/outreach", element: <Outreach /> },
      { path: "/reports", element: <Reports /> },
      { path: "/settings", element: <Settings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <WorkspaceProvider>
        <RouterProvider router={router} />
      </WorkspaceProvider>
    </ErrorBoundary>
  </StrictMode>,
);
