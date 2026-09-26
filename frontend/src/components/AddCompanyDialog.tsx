/**
 * Add a prospect and run the whole pipeline for it.
 *
 * This is the one control in the dashboard that takes minutes rather than
 * milliseconds - it scrapes, asks the model about every signal, then scores -
 * so it says so plainly instead of showing a spinner and hoping.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/api";
import { useWorkspace } from "@/workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { Banner } from "@/components/states";

export function AddCompanyDialog({
  trigger,
  onAdded,
}: {
  trigger?: React.ReactNode;
  onAdded?: () => void;
}) {
  const { serviceKey } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const valid = name.trim().length > 0 && cleanDomain.includes(".");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await api.addCompany({ name: name.trim(), domain: cleanDomain, service: serviceKey || undefined });
      setDone(`${name.trim()} was scraped, evaluated and scored.`);
      setName("");
      setDomain("");
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Closing mid-run would hide the only feedback the request has.
        if (busy) return;
        setOpen(v);
        if (!v) {
          setError(null);
          setDone(null);
        }
      }}
    >
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button className="rounded-full px-5">
            <Plus className="size-4" />
            Add lead
          </Button>
        )}
      </span>

      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add a prospect</DialogTitle>
            <DialogDescription>
              Crawls the company site, its careers page and the news, asks the model about every signal question, then
              scores it. Expect a minute or two — leave this open.
            </DialogDescription>
          </DialogHeader>

          {error && <Banner tone="error">{error}</Banner>}
          {done && <Banner tone="ok">{done}</Banner>}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-name">Company name</Label>
              <Input
                id="add-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Logistics"
                disabled={busy}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-domain">Domain</Label>
              <Input
                id="add-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                disabled={busy}
                required
              />
              <p className="text-xs text-muted-foreground">
                {cleanDomain && !cleanDomain.includes(".")
                  ? "That does not look like a domain."
                  : "Just the host — https:// and paths are stripped."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "Scraping and scoring…" : "Add and run the pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
