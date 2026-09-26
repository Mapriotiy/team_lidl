import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Citrus,
  Database,
  ExternalLink,
  LayoutDashboard,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
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
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-1.screen.css";

export default function Screen1() {
  const navigate = useNavigate();
  return (
    <div data-appearance="light">
      <div className="bg-background text-foreground w-full h-fit h-fit min-h-screen w-screen min-w-screen max-w-screen overflow-visible">
        <div className="bg-background text-foreground min-h-screen">
          <aside className="bg-sidebar border-y-border border-r border-r-border border-l-border flex fixed z-20 top-0 bottom-0 left-0 pt-5 pr-4 pb-5 pl-4 flex-col w-[248px]">
            <div className="flex pr-2 pb-8 pl-2 items-center gap-2.5">
              <span className="rounded-full bg-primary flex justify-center items-center size-7">
                <Citrus
                  className="text-primary-foreground size-4"
                  strokeWidth={1.75}
                />
              </span>
              <span className="font-semibold text-foreground text-sm tracking-tight">
                orange systems
              </span>
            </div>
            <nav className="flex flex-col flex-1 gap-3">
              <a className="font-medium rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
                <LayoutDashboard className="size-[18px]" strokeWidth={1.6} />
                <span>Overview</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-2")}
              >
                <Users className="size-[18px]" strokeWidth={1.6} />
                <span>Leads</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-4")}
              >
                <Radio className="size-[18px]" strokeWidth={1.6} />
                <span>Signals</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-5")}
              >
                <Target className="size-[18px]" strokeWidth={1.6} />
                <span>{`ICP & Scoring`}</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-6")}
              >
                <Database className="size-[18px]" strokeWidth={1.6} />
                <span>Data Sources</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-7")}
              >
                <Send className="size-[18px]" strokeWidth={1.6} />
                <span>Outreach</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-8")}
              >
                <BarChart3 className="size-[18px]" strokeWidth={1.6} />
                <span>Reports</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-9")}
              >
                <Settings className="size-[18px]" strokeWidth={1.6} />
                <span>Settings</span>
              </a>
            </nav>
            <div className="rounded-xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-3 pr-3 pb-3 pl-3">
              <p className="font-medium text-ellipsis whitespace-nowrap text-foreground text-sm overflow-hidden">
                Acme Revenue Team
              </p>
              <p className="text-muted-foreground text-xs mt-1">Growth plan</p>
            </div>
          </aside>
          <header className="bg-background border-t-border border-r-border border-b border-b-border border-l-border flex fixed z-10 top-0 right-0 left-0 ml-[248px] pr-8 pl-8 justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Workspace</span>
              <ChevronRight
                className="text-muted-foreground size-4"
                strokeWidth={1.6}
              />
              <h1 className="font-semibold text-foreground text-lg">
                Overview
              </h1>
            </div>
            <div className="flex items-center gap-5">
              <div className="rounded-xl bg-card text-muted-foreground text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pr-3 pl-3 items-center gap-2.5 w-[320px] h-10">
                <Search className="size-[18px]" strokeWidth={1.7} />
                <span className="flex-1">
                  Search companies, signals, people…
                </span>
                <kbd className="rounded-md bg-muted text-xs border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-0.5 pr-1.5 pb-0.5 pl-1.5">
                  ⌘ K
                </kbd>
              </div>
              <Bell
                className="text-muted-foreground size-5"
                strokeWidth={1.7}
              />
              <div className="font-semibold rounded-full bg-muted text-xs flex justify-center items-center size-9">
                AS
              </div>
            </div>
          </header>
          <main className="ml-[248px] pt-[116px] pr-8 pb-10 pl-8 min-h-screen">
            <div className="flex flex-col gap-6 max-w-[1424px]">
              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-2">
                  <h2 className="font-semibold text-3xl tracking-tight">
                    Good morning, Alex
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Here’s what changed across your pipeline this week.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select defaultValue="30">
                    <SelectTrigger className="rounded-xl bg-card w-[150px] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="rounded-full bg-primary text-primary-foreground text-sm pr-5 pl-5 h-10"
                    onClick={() => navigate("/screen-2")}
                  >
                    <Plus className="mr-2 size-4" />
                    Add lead
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-4">
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="text-muted-foreground text-sm">
                      Qualified leads
                    </span>
                    <span className="font-semibold text-3xl tracking-tight">
                      248
                    </span>
                  </CardHeader>
                  <CardFooter className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="bg-[oklch(0.94_0.08_155)] text-[oklch(0.38_0.12_155)] font-medium rounded-full text-xs pt-1 pr-2 pb-1 pl-2">
                      +18.4%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      vs. previous period
                    </span>
                  </CardFooter>
                </Card>
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="text-muted-foreground text-sm">
                      Avg. lead score
                    </span>
                    <span className="font-semibold text-3xl tracking-tight">
                      72
                    </span>
                  </CardHeader>
                  <CardFooter className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="bg-[oklch(0.94_0.08_155)] text-[oklch(0.38_0.12_155)] font-medium rounded-full text-xs pt-1 pr-2 pb-1 pl-2">
                      +6.2%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      vs. previous period
                    </span>
                  </CardFooter>
                </Card>
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="text-muted-foreground text-sm">
                      Signals detected
                    </span>
                    <span className="font-semibold text-3xl tracking-tight">
                      1,842
                    </span>
                  </CardHeader>
                  <CardFooter className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="bg-[oklch(0.94_0.08_155)] text-[oklch(0.38_0.12_155)] font-medium rounded-full text-xs pt-1 pr-2 pb-1 pl-2">
                      +24.8%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      vs. previous period
                    </span>
                  </CardFooter>
                </Card>
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-4">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="text-muted-foreground text-sm">
                      Pipeline influenced
                    </span>
                    <span className="font-semibold text-3xl tracking-tight">
                      $1.28M
                    </span>
                  </CardHeader>
                  <CardFooter className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <span className="bg-[oklch(0.94_0.08_155)] text-[oklch(0.38_0.12_155)] font-medium rounded-full text-xs pt-1 pr-2 pb-1 pl-2">
                      +12.1%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      vs. previous period
                    </span>
                  </CardFooter>
                </Card>
              </div>
              <div className="grid gap-4 grid-cols-[minmax(0,1fr)_280px]">
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-6">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 flex-row justify-between items-start gap-4">
                    <div className="flex flex-col gap-2">
                      <CardTitle className="text-lg">Pipeline health</CardTitle>
                      <p className="text-muted-foreground text-sm">
                        Qualified pipeline movement over the selected period
                      </p>
                    </div>
                    <div className="text-muted-foreground text-xs flex items-center gap-4">
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-primary size-2" />
                        Qualified
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="border-[oklch(0.62_0.12_245)] rounded-full bg-transparent border-t border-r border-b border-l size-2" />
                        Comparison
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pr-0 pb-0 pl-0 h-[270px]">
                    <ChartContainer
                      config={{
                        qualified: {
                          label: "Qualified",
                          color: "oklch(0.145 0 0)",
                        },
                        comparison: {
                          label: "Comparison",
                          color: "oklch(0.62 0.12 245)",
                        },
                      }}
                      className="size-full"
                    >
                      <RechartsAreaChart
                        data={[
                          { day: "May 1", qualified: 38, comparison: 32 },
                          { day: "May 6", qualified: 46, comparison: 38 },
                          { day: "May 11", qualified: 42, comparison: 40 },
                          { day: "May 16", qualified: 61, comparison: 47 },
                          { day: "May 21", qualified: 68, comparison: 55 },
                          { day: "May 26", qualified: 76, comparison: 63 },
                          { day: "May 30", qualified: 88, comparison: 69 },
                        ]}
                      >
                        <defs>
                          <linearGradient
                            id="pipelineFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="oklch(0.145 0 0)"
                              stopOpacity="0.18"
                            />
                            <stop
                              offset="100%"
                              stopColor="oklch(0.145 0 0)"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="oklch(0.9 0 0)"
                        />
                        <XAxis
                          dataKey="day"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "oklch(0.46 0 0)", fontSize: 12 }}
                        />
                        <YAxis hide={true} />
                        <ChartTooltip />
                        <Area
                          type="monotone"
                          dataKey="qualified"
                          stroke="oklch(0.145 0 0)"
                          strokeWidth={2.5}
                          fill="url(#pipelineFill)"
                        />
                        <Line
                          type="monotone"
                          dataKey="comparison"
                          stroke="oklch(0.62 0.12 245)"
                          strokeWidth={2}
                          strokeDasharray="3 5"
                          dot={false}
                        />
                      </RechartsAreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-5">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                    <CardTitle className="text-lg">Needs attention</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      Follow up before momentum slows.
                    </p>
                  </CardHeader>
                  <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-5">
                    <div className="rounded-xl bg-muted flex pt-4 pr-4 pb-4 pl-4 justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        Stale leads
                      </span>
                      <span className="font-semibold text-2xl">12</span>
                    </div>
                    <div className="rounded-xl border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pt-4 pr-4 pb-4 pl-4 flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-muted-foreground size-4" />
                        <span className="font-medium text-sm">
                          No overdue tasks
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-5">
                        You’re all caught up on assigned follow-ups.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-5">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 flex-row justify-between items-center gap-4">
                    <CardTitle className="text-lg">
                      Top accounts by score
                    </CardTitle>
                    <Button
                      variant="ghost"
                      className="rounded-full text-muted-foreground text-xs pr-3 pl-3 h-8"
                      onClick={() => navigate("/screen-2")}
                    >
                      View all
                    </Button>
                  </CardHeader>
                  <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-1">
                    <div
                      className="border-t-border border-r-border border-b border-b-border border-l-border flex pt-3 pb-3 justify-between items-center"
                      onClick={() => navigate("/screen-3")}
                    >
                      <span className="font-medium text-sm">Datadog</span>
                      <span className="font-semibold text-sm flex items-center gap-3">
                        94
                        <ExternalLink className="text-muted-foreground size-3.5" />
                      </span>
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pt-3 pb-3 justify-between items-center">
                      <span className="font-medium text-sm">Ramp</span>
                      <span className="font-semibold text-sm flex items-center gap-3">
                        91
                        <ExternalLink className="text-muted-foreground size-3.5" />
                      </span>
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pt-3 pb-3 justify-between items-center">
                      <span className="font-medium text-sm">Retool</span>
                      <span className="font-semibold text-sm flex items-center gap-3">
                        88
                        <ExternalLink className="text-muted-foreground size-3.5" />
                      </span>
                    </div>
                    <div className="flex pt-3 pb-3 justify-between items-center">
                      <span className="font-medium text-sm">Vanta</span>
                      <span className="font-semibold text-sm flex items-center gap-3">
                        86
                        <ExternalLink className="text-muted-foreground size-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-5">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 flex-row justify-between items-center gap-4">
                    <CardTitle className="text-lg">Recent signals</CardTitle>
                    <Button
                      variant="ghost"
                      className="rounded-full text-muted-foreground text-xs pr-3 pl-3 h-8"
                      onClick={() => navigate("/screen-4")}
                    >
                      View all
                    </Button>
                  </CardHeader>
                  <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-4">
                    <div className="flex gap-3">
                      <span className="rounded-full bg-muted flex mt-1 justify-center items-center shrink-0 size-7">
                        <TrendingUp className="size-3.5" />
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-sm">
                          Datadog hired a VP of RevOps
                        </p>
                        <p className="text-muted-foreground text-xs">
                          2h ago · LinkedIn
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="rounded-full bg-muted flex mt-1 justify-center items-center shrink-0 size-7">
                        <BriefcaseBusiness className="size-3.5" />
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-sm">
                          Ramp opened 3 enterprise roles
                        </p>
                        <p className="text-muted-foreground text-xs">
                          5h ago · Greenhouse
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="rounded-full bg-muted flex mt-1 justify-center items-center shrink-0 size-7">
                        <Sparkles className="size-3.5" />
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-sm">
                          Vanta raised Series C funding
                        </p>
                        <p className="text-muted-foreground text-xs">
                          yesterday · Crunchbase
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
