import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Citrus,
  Database,
  Download,
  LayoutDashboard,
  Radio,
  Search,
  Send,
  Settings,
  Target,
  Users,
} from "lucide-react";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-8.screen.css";

export default function Screen8() {
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
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-7")}
              >
                <Send />
                <span>Outreach</span>
              </a>
              <a className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
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
          <main className="ml-[248px] pt-28 pr-8 pb-12 pl-8 self-start min-h-screen">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-3xl tracking-tight">
                  Reports
                </h2>
                <p className="text-muted-foreground text-base">
                  Understand what moves your pipeline.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="font-medium shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-xl bg-card text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pr-4 pl-4 items-center gap-2 h-10">
                  <CalendarDays className="text-muted-foreground size-4" />
                  <span>May 1–May 30, 2024</span>
                  <ChevronDown className="text-muted-foreground size-4" />
                </button>
                <button className="font-medium shadow-[0px_1px_3px_rgba(0,_0,_0,_0.1),_0px_1px_2px_-1px_rgba(0,_0,_0,_0.1)] rounded-xl bg-primary text-primary-foreground text-sm flex pr-4 pl-4 items-center gap-2 h-10">
                  <Download className="size-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
            <div className="grid mt-8 gap-4 grid-cols-4">
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-5 pr-5 pb-5 pl-5">
                <p className="text-muted-foreground text-sm">
                  Influenced pipeline
                </p>
                <div className="flex mt-3 justify-between items-end gap-2">
                  <p className="font-semibold text-2xl tracking-tight">
                    $1.28M
                  </p>
                  <span className="font-medium text-chart-3 text-sm flex items-center gap-1">
                    <ArrowUpRight className="size-4" />
                    12.1%
                  </span>
                </div>
              </div>
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-5 pr-5 pb-5 pl-5">
                <p className="text-muted-foreground text-sm">
                  Qualified accounts
                </p>
                <div className="flex mt-3 justify-between items-end gap-2">
                  <p className="font-semibold text-2xl tracking-tight">248</p>
                  <span className="font-medium text-chart-3 text-sm flex items-center gap-1">
                    <ArrowUpRight className="size-4" />
                    18.4%
                  </span>
                </div>
              </div>
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-5 pr-5 pb-5 pl-5">
                <p className="text-muted-foreground text-sm">
                  Signal-to-opportunity
                </p>
                <div className="flex mt-3 justify-between items-end gap-2">
                  <p className="font-semibold text-2xl tracking-tight">21.6%</p>
                  <span className="font-medium text-chart-3 text-sm flex items-center gap-1">
                    <ArrowUpRight className="size-4" />
                    4.2%
                  </span>
                </div>
              </div>
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-5 pr-5 pb-5 pl-5">
                <p className="text-muted-foreground text-sm">
                  Avg. days to qualify
                </p>
                <div className="flex mt-3 justify-between items-end gap-2">
                  <p className="font-semibold text-2xl tracking-tight">
                    6.4 days
                  </p>
                  <span className="font-medium text-chart-3 text-sm flex items-center gap-1">
                    <ArrowDownRight className="size-4" />
                    1.8d
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border mt-6 pt-6 pr-6 pb-6 pl-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-base">
                    Pipeline influenced
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Influenced pipeline value over time
                  </p>
                </div>
                <div className="text-muted-foreground text-xs flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-primary size-2" />
                    2024
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="border-x-dotted border-x-chart-2 border-t border-t-dotted border-t-chart-2 border-b-dotted border-b-chart-2 w-4 h-0" />
                    Previous period
                  </span>
                </div>
              </div>
              <div className="relative mt-6 h-[260px]">
                <svg
                  viewBox="0 0 1100 260"
                  preserveAspectRatio="none"
                  className="size-full"
                >
                  <path
                    d="M0 220 H1100 M0 165 H1100 M0 110 H1100 M0 55 H1100"
                    stroke="oklch(0.9 0 0)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    d="M0 218 C75 205 105 190 165 198 S270 174 330 181 S430 145 495 157 S600 120 660 137 S760 98 825 112 S925 75 995 88 S1060 52 1100 62"
                    stroke="oklch(0.62 0.12 245)"
                    strokeWidth="2"
                    strokeDasharray="4 6"
                    fill="none"
                  />
                  <path
                    d="M0 224 C70 215 108 198 165 207 S270 185 330 192 S430 158 495 174 S600 132 660 148 S760 108 825 126 S925 84 995 101 S1060 62 1100 74 L1100 260 L0 260 Z"
                    fill="oklch(0.145 0 0 / 0.08)"
                  />
                  <path
                    d="M0 224 C70 215 108 198 165 207 S270 185 330 192 S430 158 495 174 S600 132 660 148 S760 108 825 126 S925 84 995 101 S1060 62 1100 74"
                    stroke="oklch(0.145 0 0)"
                    strokeWidth="3"
                    fill="none"
                  />
                </svg>
                <div className="shadow-[0px_4px_6px_-1px_rgba(0,_0,_0,_0.1),_0px_2px_4px_-2px_rgba(0,_0,_0,_0.1)] rounded-lg bg-popover border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border absolute top-[18%] left-[73%] pt-2 pr-3 pb-2 pl-3">
                  <p className="text-muted-foreground text-xs">May 24</p>
                  <p className="font-semibold text-sm mt-1">$184k</p>
                </div>
                <div className="text-muted-foreground text-xs flex absolute right-0 bottom-0 left-0 justify-between">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                </div>
              </div>
            </div>
            <div className="grid mt-6 gap-6 grid-cols-12">
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-6 pr-6 pb-6 pl-6 col-span-5">
                <h3 className="font-semibold text-base">Signals by category</h3>
                <div className="border-t-border border-r-border border-b border-b-border border-l-border flex mt-6 pr-5 pl-5 justify-around items-end gap-6 h-[220px]">
                  <div className="flex flex-col justify-end items-center flex-1 gap-3 h-full">
                    <span className="font-medium text-sm">42</span>
                    <div
                      className="rounded-t-lg bg-primary w-12"
                      style={{ height: "168px" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Hiring
                    </span>
                  </div>
                  <div className="flex flex-col justify-end items-center flex-1 gap-3 h-full">
                    <span className="font-medium text-sm">31</span>
                    <div
                      className="rounded-t-lg bg-chart-2 w-12"
                      style={{ height: "124px" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Technology
                    </span>
                  </div>
                  <div className="flex flex-col justify-end items-center flex-1 gap-3 h-full">
                    <span className="font-medium text-sm">24</span>
                    <div
                      className="rounded-t-lg bg-chart-3 w-12"
                      style={{ height: "96px" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Leadership
                    </span>
                  </div>
                  <div className="flex flex-col justify-end items-center flex-1 gap-3 h-full">
                    <span className="font-medium text-sm">18</span>
                    <div
                      className="rounded-t-lg bg-chart-4 w-12"
                      style={{ height: "72px" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Funding
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-6 pr-6 pb-6 pl-6 col-span-4">
                <h3 className="font-semibold text-base">
                  Top performing segments
                </h3>
                <div className="flex mt-5 flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">1</span>
                    <span className="font-medium text-sm flex-1">SaaS</span>
                    <span className="font-semibold rounded-full bg-primary text-primary-foreground text-xs pt-1 pr-3 pb-1 pl-3">
                      38%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">2</span>
                    <span className="font-medium text-sm flex-1">Fintech</span>
                    <span className="font-semibold rounded-full bg-muted text-xs pt-1 pr-3 pb-1 pl-3">
                      27%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">3</span>
                    <span className="font-medium text-sm flex-1">
                      Developer tools
                    </span>
                    <span className="font-semibold rounded-full bg-muted text-xs pt-1 pr-3 pb-1 pl-3">
                      19%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5">4</span>
                    <span className="font-medium text-sm flex-1">
                      Compliance
                    </span>
                    <span className="font-semibold rounded-full bg-muted text-xs pt-1 pr-3 pb-1 pl-3">
                      16%
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pt-6 pr-6 pb-6 pl-6 col-span-3">
                <div className="flex flex-col items-start gap-4">
                  <CalendarDays className="text-muted-foreground size-10" />
                  <div>
                    <h3 className="font-semibold text-base">
                      No report schedules
                    </h3>
                    <p className="text-muted-foreground text-sm leading-6 mt-2">
                      Create a schedule to receive reports automatically.
                    </p>
                  </div>
                  <button className="font-medium rounded-xl bg-primary text-primary-foreground text-sm flex pr-4 pl-4 items-center h-10">
                    Schedule report
                  </button>
                </div>
              </div>
            </div>
          </main>
          <header className="bg-background border-t-border border-r-border border-b border-b-border border-l-border flex fixed z-10 top-0 right-0 left-0 ml-[248px] pr-8 pl-8 justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Workspace</span>
              <ChevronRight className="text-muted-foreground size-4" />
              <h1 className="font-semibold text-lg">Reports</h1>
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
        </div>
      </div>
    </div>
  );
}
