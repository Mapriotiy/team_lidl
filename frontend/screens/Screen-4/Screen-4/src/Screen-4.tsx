import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  Citrus,
  Database,
  LayoutDashboard,
  Radio,
  Search,
  Send,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-4.screen.css";

export default function Screen4() {
  const navigate = useNavigate();
  return (
    <div data-appearance="light">
      <div className="bg-background text-foreground w-full h-fit h-fit min-h-screen w-screen min-w-screen max-w-screen overflow-visible">
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
            <a className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
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
            <h1 className="font-semibold text-lg">Signals</h1>
          </div>
          <div className="flex items-center gap-5">
            <div className="rounded-xl bg-card text-muted-foreground text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pr-3 pl-3 items-center gap-2.5 w-[320px] h-10">
              <Search />
              <span className="flex-1">Search companies, signals, people…</span>
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
        <main className="ml-[248px] pt-28 pr-8 pb-8 pl-8 min-h-screen">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold text-3xl tracking-tight">Signals</h2>
              <p className="text-muted-foreground text-sm">
                Fresh buying intent from your market.
              </p>
            </div>
            <Button className="rounded-xl bg-primary text-primary-foreground text-sm pr-4 pl-4 h-10">
              Create signal
            </Button>
          </div>
          <div className="flex mt-8 justify-between items-center">
            <Tabs defaultValue="all">
              <TabsList className="rounded-xl bg-muted pt-1 pr-1 pb-1 pl-1 gap-1 h-10">
                <TabsTrigger
                  value="all"
                  className="rounded-lg text-sm pr-4 pl-4"
                >
                  All signals
                </TabsTrigger>
                <TabsTrigger
                  value="hiring"
                  className="rounded-lg text-sm pr-4 pl-4"
                >
                  Hiring
                </TabsTrigger>
                <TabsTrigger
                  value="funding"
                  className="rounded-lg text-sm pr-4 pl-4"
                >
                  Funding
                </TabsTrigger>
                <TabsTrigger
                  value="technology"
                  className="rounded-lg text-sm pr-4 pl-4"
                >
                  Technology
                </TabsTrigger>
                <TabsTrigger
                  value="leadership"
                  className="rounded-lg text-sm pr-4 pl-4"
                >
                  Leadership
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Select defaultValue="7">
              <SelectTrigger className="rounded-xl bg-card w-[150px] h-10">
                <SelectValue placeholder="Last 7 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid mt-6 gap-6 grid-cols-[minmax(0,1fr)_360px]">
            <Card className="pt-6 pr-6 pb-6 pl-6 gap-4">
              <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                <CardTitle className="text-lg">Recent activity</CardTitle>
                <CardDescription>
                  Buying intent signals from tracked companies
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-0">
                <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pt-5 pb-5 justify-between items-center">
                  <div className="flex items-start gap-4">
                    <Badge className="rounded-lg bg-primary text-primary-foreground pt-1 pr-2.5 pb-1 pl-2.5">
                      92
                    </Badge>
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-sm">Ramp</p>
                      <p className="text-foreground text-sm">
                        Opened 12 enterprise account executive roles
                      </p>
                      <p className="text-muted-foreground text-xs">
                        18 minutes ago<span className="pr-1 pl-1">·</span>
                        LinkedIn
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground text-sm gap-2"
                  >
                    View evidence
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
                <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pt-5 pb-5 justify-between items-center">
                  <div className="flex items-start gap-4">
                    <Badge className="rounded-lg bg-primary text-primary-foreground pt-1 pr-2.5 pb-1 pl-2.5">
                      88
                    </Badge>
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-sm">Vanta</p>
                      <p className="text-foreground text-sm">
                        Raised Series C funding
                      </p>
                      <p className="text-muted-foreground text-xs">
                        2 hours ago<span className="pr-1 pl-1">·</span>
                        Crunchbase
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground text-sm gap-2"
                  >
                    View evidence
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
                <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pt-5 pb-5 justify-between items-center">
                  <div className="flex items-start gap-4">
                    <Badge className="rounded-lg bg-primary text-primary-foreground pt-1 pr-2.5 pb-1 pl-2.5">
                      81
                    </Badge>
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-sm">Retool</p>
                      <p className="text-foreground text-sm">
                        Hired VP of Sales
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Yesterday<span className="pr-1 pl-1">·</span>Company
                        site
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground text-sm gap-2"
                  >
                    View evidence
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
                <div className="flex pt-5 pb-5 justify-between items-center">
                  <div className="flex items-start gap-4">
                    <Badge className="rounded-lg bg-primary text-primary-foreground pt-1 pr-2.5 pb-1 pl-2.5">
                      76
                    </Badge>
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-sm">Brex</p>
                      <p className="text-foreground text-sm">
                        Adopted Snowflake
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Yesterday<span className="pr-1 pl-1">·</span>BuiltWith
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground text-sm gap-2"
                  >
                    View evidence
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
              <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                <CardTitle className="text-lg">Signal volume</CardTitle>
                <CardDescription>Signals by category</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-5">
                <div className="flex items-center gap-4">
                  <span className="text-sm w-20">Hiring</span>
                  <div className="rounded-full bg-muted flex-1 h-3">
                    <div className="rounded-full bg-primary w-[84%] h-3" />
                  </div>
                  <span className="font-medium text-right text-sm w-8">42</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm w-20">Funding</span>
                  <div className="rounded-full bg-muted flex-1 h-3">
                    <div className="rounded-full bg-primary w-[36%] h-3" />
                  </div>
                  <span className="font-medium text-right text-sm w-8">18</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm w-20">Technology</span>
                  <div className="rounded-full bg-muted flex-1 h-3">
                    <div className="rounded-full bg-primary w-[62%] h-3" />
                  </div>
                  <span className="font-medium text-right text-sm w-8">31</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm w-20">Leadership</span>
                  <div className="rounded-full bg-muted flex-1 h-3">
                    <div className="rounded-full bg-primary w-[48%] h-3" />
                  </div>
                  <span className="font-medium text-right text-sm w-8">24</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="rounded-xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex mt-6 pr-4 pl-4 items-center gap-3 h-14">
            <div className="animate-pulse rounded-full bg-muted-foreground/40 size-2.5" />
            <div className="animate-pulse rounded-full bg-muted w-32 h-2.5" />
            <span className="text-muted-foreground text-sm">
              Syncing 6 new signals…
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
