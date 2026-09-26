import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Citrus,
  Database,
  ExternalLink,
  LayoutDashboard,
  ListFilter,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Target,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-7.screen.css";

export default function Screen7() {
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
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-6")}
              >
                <Database />
                <span>Data Sources</span>
              </a>
              <a className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
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
              <h1 className="font-semibold text-lg">Outreach</h1>
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
                  Outreach
                </h2>
                <p className="text-muted-foreground text-sm">
                  Turn intent into thoughtful first touches.
                </p>
              </div>
              <button className="font-medium rounded-xl bg-primary text-primary-foreground text-sm inline-flex pr-4 pl-4 items-center gap-2 h-10">
                <Plus className="size-4" />
                New sequence
              </button>
            </div>
            <Tabs className="mt-8" defaultValue="sequences">
              <TabsList className="rounded-xl bg-muted pt-1 pr-1 pb-1 pl-1 h-11">
                <TabsTrigger
                  value="sequences"
                  className="rounded-lg text-sm pr-5 pl-5"
                >
                  Sequences
                </TabsTrigger>
                <TabsTrigger
                  value="templates"
                  className="rounded-lg text-sm pr-5 pl-5"
                >
                  Templates
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="rounded-lg text-sm pr-5 pl-5"
                >
                  Activity
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid mt-6 items-start gap-6 grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex flex-col gap-6">
                <Card className="pt-6 pr-6 pb-6 pl-6 gap-4">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 flex-row justify-between items-center gap-2">
                    <div>
                      <CardTitle className="text-lg">Sequences</CardTitle>
                      <CardDescription className="mt-1">
                        Automated touches for your highest-intent leads.
                      </CardDescription>
                    </div>
                    <button className="rounded-lg text-muted-foreground text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-2 pr-3 pb-2 pl-3">
                      <ListFilter className="inline mr-2 size-4" />
                      Filter
                    </button>
                  </CardHeader>
                  <CardContent className="pt-0 pr-0 pb-0 pl-0">
                    <div className="font-medium uppercase text-muted-foreground text-xs tracking-wide border-t-border border-r-border border-b border-b-border border-l-border grid pt-3 pr-2 pb-3 pl-2 gap-4 grid-cols-[2fr_1.3fr_.8fr_1fr_1fr_1fr]">
                      <span>Sequence</span>
                      <span>Audience</span>
                      <span>Enrolled</span>
                      <span>Open rate</span>
                      <span>Reply rate</span>
                      <span>Status</span>
                    </div>
                    <div className="text-sm border-t-border border-r-border border-b border-b-border border-l-border grid pt-5 pr-2 pb-5 pl-2 items-center gap-4 grid-cols-[2fr_1.3fr_.8fr_1fr_1fr_1fr]">
                      <div className="flex items-center gap-3">
                        <Play className="text-muted-foreground size-4" />
                        <span className="font-medium">
                          High intent — hiring signal
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        Score above 80
                      </span>
                      <span>42</span>
                      <span>68%</span>
                      <span>14%</span>
                      <span className="font-medium rounded-full bg-primary text-primary-foreground text-xs pt-1 pr-2.5 pb-1 pl-2.5 w-fit">
                        Active
                      </span>
                    </div>
                    <div className="text-sm border-t-border border-r-border border-b border-b-border border-l-border grid pt-5 pr-2 pb-5 pl-2 items-center gap-4 grid-cols-[2fr_1.3fr_.8fr_1fr_1fr_1fr]">
                      <div className="flex items-center gap-3">
                        <Play className="text-muted-foreground size-4" />
                        <span className="font-medium">Funding momentum</span>
                      </div>
                      <span className="text-muted-foreground">
                        Funding signal
                      </span>
                      <span>28</span>
                      <span>74%</span>
                      <span>18%</span>
                      <span className="font-medium rounded-full bg-primary text-primary-foreground text-xs pt-1 pr-2.5 pb-1 pl-2.5 w-fit">
                        Active
                      </span>
                    </div>
                    <div className="text-sm grid pt-5 pr-2 pb-5 pl-2 items-center gap-4 grid-cols-[2fr_1.3fr_.8fr_1fr_1fr_1fr]">
                      <div className="flex items-center gap-3">
                        <Pause className="text-muted-foreground size-4" />
                        <span className="font-medium">
                          Re-engage stale leads
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        No activity 30d
                      </span>
                      <span>116</span>
                      <span>52%</span>
                      <span>6%</span>
                      <span className="font-medium rounded-full bg-primary text-primary-foreground text-xs pt-1 pr-2.5 pb-1 pl-2.5 w-fit">
                        Paused
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="pt-6 pr-6 pb-6 pl-6 gap-4">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0">
                    <CardTitle className="text-lg">Recent activity</CardTitle>
                  </CardHeader>
                  <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold rounded-full bg-muted text-xs flex justify-center items-center size-9">
                        AM
                      </div>
                      <div className="flex justify-between items-center flex-1">
                        <div>
                          <p className="font-medium text-sm flex items-center gap-2">
                            Alex Morgan
                            <ExternalLink className="text-muted-foreground size-3.5" />
                          </p>
                          <p className="text-muted-foreground text-sm">
                            sent 12 emails
                          </p>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          Today
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-semibold rounded-full bg-muted text-xs flex justify-center items-center size-9">
                        JL
                      </div>
                      <div className="flex justify-between items-center flex-1">
                        <div>
                          <p className="font-medium text-sm flex items-center gap-2">
                            Jordan Lee
                            <ExternalLink className="text-muted-foreground size-3.5" />
                          </p>
                          <p className="text-muted-foreground text-sm">
                            replied from Ramp
                          </p>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          30 minutes ago
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="border-t-border border-r-border border-b border-b-border border-l-border pt-0 pr-0 pb-5 pl-0">
                  <CardTitle className="text-lg">Sequence preview</CardTitle>
                  <CardDescription className="mt-1">
                    High intent — hiring signal
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="font-medium uppercase text-muted-foreground text-xs tracking-wide">
                      Audience filter
                    </span>
                    <div className="rounded-xl bg-muted text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pt-3 pr-3 pb-3 pl-3 justify-between items-center">
                      <span>Score above 80</span>
                      <span className="text-muted-foreground">42 contacts</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-5">
                    <span className="font-medium uppercase text-muted-foreground text-xs tracking-wide">
                      Step timeline
                    </span>
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="rounded-full bg-primary text-primary-foreground text-xs flex justify-center items-center size-7">
                          1
                        </div>
                        <div className="bg-border w-px h-12" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Day 1 · Email</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          A relevant idea for your growth team
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="rounded-full bg-primary text-primary-foreground text-xs flex justify-center items-center size-7">
                          2
                        </div>
                        <div className="bg-border w-px h-12" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          Day 3 · LinkedIn touch
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="rounded-full bg-primary text-primary-foreground text-xs flex justify-center items-center size-7">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-sm">Day 7 · Follow-up</p>
                      </div>
                    </div>
                  </div>
                  <button className="font-medium rounded-xl bg-primary text-primary-foreground text-sm h-11">
                    Enroll leads
                  </button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
