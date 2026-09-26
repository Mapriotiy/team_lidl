/**
 * Every screen except Settings is scoped to a service. This renders the three
 * states that must be handled before a screen's own data matters: the API is
 * unreachable, it answered but nothing is seeded, or the list is still loading.
 */
import type { ReactNode } from "react";
import { API_URL } from "@/api";
import { useWorkspace } from "@/workspace";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

/** Returns a node to render *instead of* the screen, or null to carry on. */
export function useServiceGate(): ReactNode | null {
  const { services, serviceKey } = useWorkspace();

  if (services.error) {
    return (
      <ErrorState
        error={services.error}
        what="the service list"
        onRetry={services.reload}
        hint={
          <>
            Start the backend with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run api</code> in the
            project root, or point the dashboard elsewhere with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VITE_API_URL</code>. Everything here reads from{" "}
            <span className="font-medium">{API_URL}</span>.
          </>
        }
      />
    );
  }

  if (services.loading && services.firstLoad) {
    return <Loading label="Connecting to the API" rows={4} />;
  }

  if (!services.data || services.data.length === 0) {
    return (
      <EmptyState
        title="No services configured"
        body={
          <>
            The API answered but no active service exists yet. Seed the database with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run seed</code> in the project root — services
            are what signal questions, ICPs and scores hang off.
          </>
        }
        action={
          <Button variant="outline" onClick={services.reload}>
            Check again
          </Button>
        }
      />
    );
  }

  if (!serviceKey) return <Loading label="Selecting a service" rows={2} />;

  return null;
}
