import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { useBreadcrumb } from "@/components/AppShell";

export function NotFound() {
  const navigate = useNavigate();
  useBreadcrumb([{ label: "Not found" }]);

  return (
    <EmptyState
      icon={Compass}
      title="No screen at this address"
      body="The link may be out of date. Everything the dashboard can show is in the sidebar."
      action={<Button onClick={() => navigate("/")}>Go to Overview</Button>}
    />
  );
}
