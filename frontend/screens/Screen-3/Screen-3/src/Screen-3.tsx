import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Citrus,
  Database,
  ExternalLink,
  LayoutDashboard,
  Radio,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { FallbackComponent } from "./CustomComponents";
import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-3.screen.css";

export default function Screen3() {
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
                className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
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
          <main className="flex ml-[248px] pt-28 pr-8 pb-12 pl-8 flex-col gap-8">
            <section className="flex justify-between items-start gap-8">
              <div className="flex items-center gap-5">
                <div className="rounded-2xl bg-card border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex justify-center items-center size-20">
                  <Building2 className="text-muted-foreground size-10" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="font-semibold text-3xl tracking-tight">
                    Datadog
                  </h2>
                  <p className="text-muted-foreground text-sm">datadoghq.com</p>
                  <div className="flex items-center gap-2">
                    <span className="font-medium rounded-full bg-muted text-xs pt-1 pr-3 pb-1 pl-3">
                      SaaS
                    </span>
                    <span className="font-medium rounded-full bg-muted text-xs pt-1 pr-3 pb-1 pl-3">
                      1,001–5,000 employees
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button className="rounded-xl bg-primary text-primary-foreground pr-5 pl-5">
                  Create outreach
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border pr-5 pl-5"
                >
                  Edit lead
                </Button>
              </div>
            </section>
            <section className="grid gap-6 grid-cols-[320px_1fr]">
              <Card className="flex pt-6 pr-6 pb-6 pl-6 flex-col justify-center items-center gap-4">
                <div className="rounded-full border-t-[12px] border-t-primary border-r-[12px] border-r-primary border-b-[12px] border-b-primary border-l-[12px] border-l-primary flex justify-center items-center size-48">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-5xl">94</span>
                    <span className="text-muted-foreground text-sm">/ 100</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">Excellent fit</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Updated 2 hours ago
                  </p>
                </div>
              </Card>
              <Card className="grid pt-6 pr-6 pb-6 pl-6 gap-4 grid-cols-3">
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm">
                    Annual revenue
                  </p>
                  <p className="font-semibold text-2xl">$2.7B</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm">HQ</p>
                  <p className="font-semibold text-2xl">New York</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm">Owner</p>
                  <p className="font-semibold text-2xl">Alex Morgan</p>
                </div>
              </Card>
            </section>
            <section className="grid gap-6 grid-cols-2">
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                  <CardTitle className="text-xl">
                    Why Datadog is a fit
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-5">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-start gap-3">
                      <BriefcaseBusiness className="text-muted-foreground mt-0.5 size-4" />
                      <div>
                        <p className="font-medium text-sm">
                          Hiring 3 RPA Developers
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          posted 4 days ago
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">+24</span>
                      <ExternalLink className="text-muted-foreground size-4" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="text-muted-foreground mt-0.5 size-4" />
                      <div>
                        <p className="font-medium text-sm">
                          Opened enterprise security initiative
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          8 days ago
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">+18</span>
                      <ExternalLink className="text-muted-foreground size-4" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="text-muted-foreground mt-0.5 size-4" />
                      <div>
                        <p className="font-medium text-sm">
                          Raised expansion budget
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          12 days ago
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">+14</span>
                      <ExternalLink className="text-muted-foreground size-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
                  <CardTitle className="text-xl">Score breakdown</CardTitle>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-5">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm w-28">
                      Firmographic
                    </span>
                    <div className="rounded-full bg-muted flex-1 h-2">
                      <div className="rounded-full bg-primary w-[92%] h-2" />
                    </div>
                    <span className="font-semibold text-right text-sm w-8">
                      92
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm w-28">
                      Intent
                    </span>
                    <div className="rounded-full bg-muted flex-1 h-2">
                      <div className="rounded-full bg-primary w-[96%] h-2" />
                    </div>
                    <span className="font-semibold text-right text-sm w-8">
                      96
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm w-28">
                      Technology
                    </span>
                    <div className="rounded-full bg-muted flex-1 h-2">
                      <div className="rounded-full bg-primary w-[89%] h-2" />
                    </div>
                    <span className="font-semibold text-right text-sm w-8">
                      89
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm w-28">
                      Timing
                    </span>
                    <div className="rounded-full bg-muted flex-1 h-2">
                      <div className="rounded-full bg-primary w-[94%] h-2" />
                    </div>
                    <span className="font-semibold text-right text-sm w-8">
                      94
                    </span>
                  </div>
                </CardContent>
              </Card>
            </section>
            <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
              <CardHeader className="pt-0 pr-0 pb-0 pl-0 flex-row justify-between items-center gap-2">
                <CardTitle className="text-xl">Evidence timeline</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add note"
                    className="rounded-xl w-56 h-9"
                    defaultValue=""
                  />
                </div>
              </CardHeader>
              <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-6">
                <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pb-5 items-start gap-4">
                  <div className="rounded-full bg-muted flex justify-center items-center size-9">
                    <FallbackComponent className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-sm">LinkedIn</p>
                      <span className="text-muted-foreground text-xs">
                        2 hours ago
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                      Datadog published new RPA developer openings.
                    </p>
                  </div>
                  <a className="text-muted-foreground text-sm flex items-center gap-1">
                    View source
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <div className="border-t-border border-r-border border-b border-b-border border-l-border flex pb-5 items-start gap-4">
                  <div className="rounded-full bg-muted flex justify-center items-center size-9">
                    <BriefcaseBusiness className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-sm">
                        Company careers page
                      </p>
                      <span className="text-muted-foreground text-xs">
                        4 days ago
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                      Three RPA Developer roles were added to the careers page.
                    </p>
                  </div>
                  <a className="text-muted-foreground text-sm flex items-center gap-1">
                    View source
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-muted flex justify-center items-center size-9">
                    <Database className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-sm">Crunchbase</p>
                      <span className="text-muted-foreground text-xs">
                        12 days ago
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                      Datadog raised its expansion budget for the next growth
                      phase.
                    </p>
                  </div>
                  <a className="text-muted-foreground text-sm flex items-center gap-1">
                    View source
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </main>
          <header className="bg-background border-t-border border-r-border border-b border-b-border border-l-border flex fixed z-10 top-0 right-0 left-0 ml-[248px] pr-8 pl-8 justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <ChevronLeft
                className="text-muted-foreground size-4"
                onClick={() => navigate("/screen-2")}
              />
              <span
                className="text-muted-foreground text-sm"
                onClick={() => navigate("/screen-2")}
              >
                Leads
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
              <h1 className="font-semibold text-lg">Datadog</h1>
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
