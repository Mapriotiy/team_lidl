import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  BarChart3,
  Bell,
  ChevronRight,
  Citrus,
  Database,
  ExternalLink,
  LayoutDashboard,
  Radio,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-2.screen.css";

export default function Screen2() {
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
              <span className="font-semibold text-sm tracking-tight">
                orange systems
              </span>
            </div>
            <nav className="flex flex-col flex-1 gap-3">
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-1")}
              >
                <LayoutDashboard className="size-[18px]" />
                <span>Overview</span>
              </a>
              <a className="font-medium rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
                <Users className="size-[18px]" />
                <span>Leads</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-4")}
              >
                <Radio className="size-[18px]" />
                <span>Signals</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-5")}
              >
                <Target className="size-[18px]" />
                <span>{`ICP & Scoring`}</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-6")}
              >
                <Database className="size-[18px]" />
                <span>Data Sources</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-7")}
              >
                <Send className="size-[18px]" />
                <span>Outreach</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-8")}
              >
                <BarChart3 className="size-[18px]" />
                <span>Reports</span>
              </a>
              <a
                className="font-medium rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-9")}
              >
                <Settings className="size-[18px]" />
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
              <h1 className="font-semibold text-lg">Leads</h1>
            </div>
            <div className="flex items-center gap-5">
              <div className="rounded-xl bg-card text-muted-foreground text-sm border-t border-t-border border-r border-r-border border-b border-b-border border-l border-l-border flex pr-3 pl-3 items-center gap-2.5 w-[320px] h-10">
                <Search className="size-[18px]" />
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
          <main className="ml-[248px] pt-28 pr-8 pb-10 pl-8 min-h-screen">
            <div className="flex flex-col gap-8">
              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-2">
                  <h2 className="font-semibold text-3xl tracking-tight">
                    Leads
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    248 accounts matching your ICP
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button className="rounded-xl pr-4 pl-4 h-10">
                    Import leads
                  </Button>
                  <Button className="rounded-xl pr-4 pl-4 h-10">
                    Add lead
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center gap-6">
                <div className="flex items-center flex-1 gap-3">
                  <Input
                    placeholder="Search by company or domain"
                    className="rounded-xl bg-card w-[320px] h-10"
                    defaultValue=""
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="secondary">All leads</Button>
                    <Button variant="secondary">High intent</Button>
                    <Button variant="secondary">Recently active</Button>
                    <Button variant="secondary">Needs review</Button>
                  </div>
                  <Button variant="outline">
                    <SlidersHorizontal className="mr-2 size-4" />
                    Filter
                  </Button>
                </div>
              </div>
              <Card className="pt-0 pr-0 pb-0 pl-0 gap-4 overflow-hidden">
                <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-0">
                  <div className="overflow-x-auto">
                    <table className="text-left border-collapse w-full">
                      <thead>
                        <tr className="font-medium bg-muted/40 text-muted-foreground text-xs border-t-border border-r-border border-b border-b-border border-l-border">
                          <th className="pt-4 pr-6 pb-4 pl-6 w-14">
                            <Checkbox defaultChecked={false} />
                          </th>
                          <th className="pt-4 pr-4 pb-4 pl-4">
                            <button className="flex items-center gap-2">
                              Company
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="pt-4 pr-4 pb-4 pl-4">
                            <button className="flex items-center gap-2">
                              Score
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="pt-4 pr-4 pb-4 pl-4">
                            <button className="flex items-center gap-2">
                              Industry
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="pt-4 pr-4 pb-4 pl-4">
                            <button className="flex items-center gap-2">
                              Intent signals
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="pt-4 pr-4 pb-4 pl-4">
                            <button className="flex items-center gap-2">
                              Owner
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="pt-4 pr-4 pb-4 pl-4">
                            <button className="flex items-center gap-2">
                              Last activity
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          className="border-t-border border-r-border border-b border-b-border border-l-border h-20"
                          onClick={() => navigate("/screen-3")}
                        >
                          <td className="pr-6 pl-6">
                            <Checkbox defaultChecked={false} />
                          </td>
                          <td className="font-medium pr-4 pl-4">Datadog</td>
                          <td className="pr-4 pl-4">
                            <span className="font-bold rounded-lg bg-primary text-primary-foreground text-lg inline-flex pt-2 pr-3 pb-2 pl-3">
                              94
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">SaaS</td>
                          <td className="pr-4 pl-4">
                            <span className="text-sm flex items-center gap-2">
                              6 signals
                              <ExternalLink className="text-muted-foreground size-4" />
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Alex Morgan</td>
                          <td className="text-muted-foreground text-sm pr-4 pl-4">
                            2h ago
                          </td>
                        </tr>
                        <tr className="border-t-border border-r-border border-b border-b-border border-l-border h-20">
                          <td className="pr-6 pl-6">
                            <Checkbox defaultChecked={false} />
                          </td>
                          <td className="font-medium pr-4 pl-4">Ramp</td>
                          <td className="pr-4 pl-4">
                            <span className="font-bold rounded-lg bg-primary text-primary-foreground text-lg inline-flex pt-2 pr-3 pb-2 pl-3">
                              91
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Fintech</td>
                          <td className="pr-4 pl-4">
                            <span className="text-sm flex items-center gap-2">
                              4 signals
                              <ExternalLink className="text-muted-foreground size-4" />
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Jordan Lee</td>
                          <td className="text-muted-foreground text-sm pr-4 pl-4">
                            5h ago
                          </td>
                        </tr>
                        <tr className="border-t-border border-r-border border-b border-b-border border-l-border h-20">
                          <td className="pr-6 pl-6">
                            <Checkbox defaultChecked={false} />
                          </td>
                          <td className="font-medium pr-4 pl-4">Retool</td>
                          <td className="pr-4 pl-4">
                            <span className="font-bold rounded-lg bg-primary text-primary-foreground text-lg inline-flex pt-2 pr-3 pb-2 pl-3">
                              88
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Developer tools</td>
                          <td className="pr-4 pl-4">
                            <span className="text-sm flex items-center gap-2">
                              5 signals
                              <ExternalLink className="text-muted-foreground size-4" />
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Alex Morgan</td>
                          <td className="text-muted-foreground text-sm pr-4 pl-4">
                            yesterday
                          </td>
                        </tr>
                        <tr className="border-t-border border-r-border border-b border-b-border border-l-border h-20">
                          <td className="pr-6 pl-6">
                            <Checkbox defaultChecked={false} />
                          </td>
                          <td className="font-medium pr-4 pl-4">Vanta</td>
                          <td className="pr-4 pl-4">
                            <span className="font-bold rounded-lg bg-muted text-lg inline-flex pt-2 pr-3 pb-2 pl-3">
                              86
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Compliance</td>
                          <td className="pr-4 pl-4">
                            <span className="text-sm flex items-center gap-2">
                              3 signals
                              <ExternalLink className="text-muted-foreground size-4" />
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Priya Shah</td>
                          <td className="text-muted-foreground text-sm pr-4 pl-4">
                            yesterday
                          </td>
                        </tr>
                        <tr className="border-t-border border-r-border border-b border-b-border border-l-border h-20">
                          <td className="pr-6 pl-6">
                            <Checkbox defaultChecked={false} />
                          </td>
                          <td className="font-medium pr-4 pl-4">Brex</td>
                          <td className="pr-4 pl-4">
                            <span className="font-bold rounded-lg bg-muted text-lg inline-flex pt-2 pr-3 pb-2 pl-3">
                              81
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Fintech</td>
                          <td className="pr-4 pl-4">
                            <span className="text-sm flex items-center gap-2">
                              4 signals
                              <ExternalLink className="text-muted-foreground size-4" />
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Jordan Lee</td>
                          <td className="text-muted-foreground text-sm pr-4 pl-4">
                            May 28
                          </td>
                        </tr>
                        <tr className="h-20">
                          <td className="pr-6 pl-6">
                            <Checkbox defaultChecked={false} />
                          </td>
                          <td className="font-medium pr-4 pl-4">Deel</td>
                          <td className="pr-4 pl-4">
                            <span className="font-bold rounded-lg bg-muted text-lg inline-flex pt-2 pr-3 pb-2 pl-3">
                              78
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">HR tech</td>
                          <td className="pr-4 pl-4">
                            <span className="text-sm flex items-center gap-2">
                              2 signals
                              <ExternalLink className="text-muted-foreground size-4" />
                            </span>
                          </td>
                          <td className="text-sm pr-4 pl-4">Alex Morgan</td>
                          <td className="text-muted-foreground text-sm pr-4 pl-4">
                            May 27
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="border-x-border border-t border-t-border border-b-border flex pt-6 pr-6 pb-6 pl-6 justify-between items-center">
                  <Button variant="outline" className="rounded-xl">
                    Export selected
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-lg">
                      Prev
                    </Button>
                    <Button>1</Button>
                    <Button variant="outline">2</Button>
                    <Button variant="outline">3</Button>
                    <span className="text-muted-foreground text-sm pr-2 pl-2">
                      …
                    </span>
                    <Button variant="outline">9</Button>
                    <Button variant="outline">10</Button>
                    <Button variant="outline" className="rounded-lg">
                      Next
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
