import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Citrus,
  Cloud,
  Code2,
  Database,
  Globe2,
  LayoutDashboard,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { FallbackComponent } from "./CustomComponents";
import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-6.screen.css";

export default function Screen6() {
  const navigate = useNavigate();
  return (
    <div data-appearance="light">
      <div className="bg-background text-foreground w-full h-fit h-fit min-h-screen w-screen min-w-screen max-w-screen overflow-visible">
        <div className="bg-background text-foreground min-h-screen">
          <aside className="bg-sidebar border-y-border border-r border-r-border border-l-border flex fixed z-20 top-0 bottom-0 left-0 pt-5 pr-4 pb-5 pl-4 flex-col w-[248px]">
            <div className="flex pr-2 pb-8 pl-2 items-center gap-2.5">
              <span className="rounded-full bg-primary flex justify-center items-center size-7">
                <Citrus className="text-primary-foreground size-4" />
              </span>
              <span className="font-semibold text-sm tracking-tight">
                orange systems
              </span>
            </div>
            <nav className="flex flex-col flex-1 gap-3">
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-1")}
              >
                <LayoutDashboard />
                <span>Overview</span>
              </a>
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-2")}
              >
                <Users />
                <span>Leads</span>
              </a>
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-4")}
              >
                <Radio />
                <span>Signals</span>
              </a>
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-5")}
              >
                <Target />
                <span>{`ICP & Scoring`}</span>
              </a>
              <a className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
                <Database />
                <span>Data Sources</span>
              </a>
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-7")}
              >
                <Send />
                <span>Outreach</span>
              </a>
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-8")}
              >
                <BarChart3 />
                <span>Reports</span>
              </a>
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-9")}
              >
                <Settings />
                <span>Settings</span>
              </a>
            </nav>
            <div className="rounded-xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-3 pr-3 pb-3 pl-3">
              <p className="font-medium text-sm">Acme Revenue Team</p>
              <p className="text-muted-foreground text-xs mt-1">Growth plan</p>
            </div>
          </aside>
          <header className="bg-background border-t-border border-r-border border-b border-b-border border-l-border flex fixed z-10 top-0 right-0 left-0 ml-[248px] pr-8 pl-8 justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Workspace</span>
              <ChevronRight className="text-muted-foreground size-4" />
              <h1 className="font-semibold text-lg">Data Sources</h1>
            </div>
            <div className="flex items-center gap-5">
              <div className="rounded-xl bg-card text-muted-foreground text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pr-3 pl-3 items-center gap-2.5 w-[320px] h-10">
                <Search />
                <span className="flex-1">
                  Search companies, signals, people…
                </span>
                <kbd className="rounded-md bg-muted text-xs border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-0.5 pr-1.5 pb-0.5 pl-1.5">
                  ⌘ K
                </kbd>
              </div>
              <Bell className="text-muted-foreground size-5" />
              <div className="font-semibold rounded-full bg-muted text-xs flex justify-center items-center size-9">
                AS
              </div>
            </div>
          </header>
          <main className="ml-[248px] pt-28 pr-8 pb-12 pl-8 min-h-screen">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-3xl tracking-tight">
                  Data sources
                </h2>
                <p className="text-muted-foreground text-sm">
                  Manage where Orange Systems learns from.
                </p>
              </div>
              <Button className="rounded-xl bg-primary text-primary-foreground text-sm pr-4 pl-4 h-10">
                <Plus className="size-4" />
                Connect source
              </Button>
            </div>
            <div className="grid mt-8 gap-6 grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex flex-col gap-4">
                <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl text-foreground border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex justify-center items-center size-11">
                        <FallbackComponent className="size-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-medium">
                          LinkedIn Sales Navigator
                        </h3>
                        <div className="text-muted-foreground text-xs flex items-center gap-2">
                          <span className="rounded-full bg-secondary text-secondary-foreground pt-1 pr-2 pb-1 pl-2">
                            Connected
                          </span>
                          <span>Last sync 8 minutes ago</span>
                        </div>
                      </div>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="border-x-border border-t border-t-border border-b-border flex pt-4 justify-between items-center">
                    <span className="text-muted-foreground text-sm">
                      1,248 records
                    </span>
                    <Button
                      variant="ghost"
                      className="rounded-lg text-sm pr-3 pl-3 h-8"
                    >
                      Configure
                    </Button>
                  </div>
                </Card>
                <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl text-foreground border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex justify-center items-center size-11">
                        <Globe2 className="size-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-medium">Crunchbase</h3>
                        <div className="text-muted-foreground text-xs flex items-center gap-2">
                          <span className="rounded-full bg-secondary text-secondary-foreground pt-1 pr-2 pb-1 pl-2">
                            Connected
                          </span>
                          <span>Last sync 2 hours ago</span>
                        </div>
                      </div>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="border-x-border border-t border-t-border border-b-border flex pt-4 justify-between items-center">
                    <span className="text-muted-foreground text-sm">
                      486 records
                    </span>
                    <Button
                      variant="ghost"
                      className="rounded-lg text-sm pr-3 pl-3 h-8"
                    >
                      Configure
                    </Button>
                  </div>
                </Card>
                <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl text-foreground border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex justify-center items-center size-11">
                        <Code2 className="size-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-medium">BuiltWith</h3>
                        <div className="text-muted-foreground text-xs flex items-center gap-2">
                          <span className="rounded-full bg-secondary text-secondary-foreground pt-1 pr-2 pb-1 pl-2">
                            Connected
                          </span>
                          <span>Last sync yesterday</span>
                        </div>
                      </div>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="border-x-border border-t border-t-border border-b-border flex pt-4 justify-between items-center">
                    <span className="text-muted-foreground text-sm">
                      3,842 records
                    </span>
                    <Button
                      variant="ghost"
                      className="rounded-lg text-sm pr-3 pl-3 h-8"
                    >
                      Configure
                    </Button>
                  </div>
                </Card>
                <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl text-foreground border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex justify-center items-center size-11">
                        <Cloud className="size-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-medium">Salesforce</h3>
                        <div className="text-muted-foreground text-xs flex items-center gap-2">
                          <span className="rounded-full bg-destructive/10 text-destructive pt-1 pr-2 pb-1 pl-2">
                            Attention needed
                          </span>
                          <span>Token expired</span>
                        </div>
                      </div>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                  <div className="border-x-border border-t border-t-border border-b-border flex pt-4 justify-between items-center">
                    <span className="text-muted-foreground text-sm">
                      Token expired
                    </span>
                    <Button className="rounded-lg bg-primary text-primary-foreground text-sm pr-3 pl-3 h-8">
                      Reconnect
                    </Button>
                  </div>
                </Card>
              </div>
              <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-6 h-fit">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                  <CardTitle className="text-base">Sync health</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Last 24h activity
                  </p>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-5">
                  <div className="flex justify-between items-end">
                    <span className="font-semibold text-4xl tracking-tight">
                      98.4%
                    </span>
                    <span className="text-muted-foreground text-sm">
                      successful
                    </span>
                  </div>
                  <div className="rounded-full bg-muted h-3 overflow-hidden">
                    <div className="rounded-full bg-primary w-[98.4%] h-full" />
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                    <div className="rounded-t-sm bg-primary/80 flex-1" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="text-center rounded-2xl bg-card border-border flex mt-6 pt-8 pr-8 pb-8 pl-8 justify-center items-center gap-4 min-h-[220px]">
              <div className="flex flex-col items-center gap-4">
                <Database className="text-muted-foreground size-10" />
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">No custom sources yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Connect a source to enrich your signals.
                  </p>
                </div>
                <Button className="rounded-xl bg-primary text-primary-foreground text-sm pr-4 pl-4 h-10">
                  Connect source
                </Button>
              </div>
            </Card>
          </main>
          <div className="bg-foreground/40 flex fixed z-30 top-0 right-0 bottom-0 left-0 pt-8 pr-8 pb-8 pl-8 justify-center items-center">
            <Card className="shadow-[0px_20px_25px_-5px_rgba(0,_0,_0,_0.1),_0px_8px_10px_-6px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-6 w-[440px]">
              <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                <CardTitle className="text-xl">
                  Disconnect Crunchbase?
                </CardTitle>
                <p className="text-muted-foreground text-sm leading-6">
                  Disconnecting Crunchbase will stop future syncs and remove its
                  connection from your data sources.
                </p>
              </CardHeader>
              <CardFooter className="pt-0 pr-0 pb-0 pl-0 justify-end gap-3">
                <Button
                  variant="secondary"
                  className="rounded-xl bg-muted text-secondary-foreground text-sm pr-4 pl-4 h-10"
                >
                  Cancel
                </Button>
                <Button className="text-destructive-foreground rounded-xl bg-destructive text-sm pr-4 pl-4 h-10">
                  Disconnect
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
