import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Citrus,
  Database,
  GripVertical,
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-5.screen.css";

export default function Screen5() {
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
              <a className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
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
              <h1 className="font-semibold text-lg">{`ICP & Scoring`}</h1>
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
          <main className="flex ml-[248px] pt-28 pr-12 pb-12 pl-12 flex-col gap-8 min-h-screen">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-3xl tracking-tight">{`ICP & Scoring`}</h2>
                <p className="text-muted-foreground text-sm">
                  Tune the model that prioritizes your next best accounts.
                </p>
              </div>
              <Button className="rounded-lg bg-primary text-primary-foreground pr-5 pl-5">
                Save changes
              </Button>
            </div>
            <div className="border-t-border border-r-border border-b border-b-border border-l-border flex items-center gap-8">
              <button>ICP profile</button>
              <button>Signal weights</button>
              <button>Rules</button>
            </div>
            <div className="grid items-start gap-8 grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex flex-col gap-6">
                <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-6">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                    <CardTitle className="text-lg">ICP profile</CardTitle>
                    <CardDescription>
                      Define the accounts your team wants to prioritize.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-0">
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center grid-cols-[180px_1fr]">
                      <span className="font-medium text-sm">Industry</span>
                      <Input
                        className="border-border h-9"
                        defaultValue="SaaS, Fintech, Developer tools"
                      />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center grid-cols-[180px_1fr]">
                      <span className="font-medium text-sm">
                        Employee count
                      </span>
                      <Input
                        className="border-border h-9"
                        defaultValue="200–5,000"
                      />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center grid-cols-[180px_1fr]">
                      <span className="font-medium text-sm">Revenue</span>
                      <Input
                        className="border-border h-9"
                        defaultValue="$25M–$5B"
                      />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center grid-cols-[180px_1fr]">
                      <span className="font-medium text-sm">Regions</span>
                      <Input
                        className="border-border h-9"
                        defaultValue="North America, Europe"
                      />
                    </div>
                    <div className="grid pt-4 pb-4 items-center grid-cols-[180px_1fr]">
                      <span className="font-medium text-sm">Technologies</span>
                      <Input
                        className="border-border h-9"
                        defaultValue="Salesforce, Snowflake, HubSpot"
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-6">
                  <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                    <CardTitle className="text-lg">Signal weights</CardTitle>
                    <CardDescription>
                      Adjust how each signal contributes to account scores.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-0">
                    <div className="font-medium text-muted-foreground text-xs border-t-border border-r-border border-b border-b-border border-l-border grid pb-3 items-center gap-4 grid-cols-[28px_1fr_90px_48px]">
                      <span />
                      <span>Signal</span>
                      <span>Weight</span>
                      <span />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center gap-4 grid-cols-[28px_1fr_90px_48px]">
                      <GripVertical className="text-muted-foreground size-4" />
                      <div>
                        <p className="font-medium text-sm">Hiring velocity</p>
                        <p className="text-muted-foreground text-xs">
                          Rapid team growth in target roles
                        </p>
                      </div>
                      <Input className="text-center h-9" defaultValue={30} />
                      <Switch defaultChecked={true} />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center gap-4 grid-cols-[28px_1fr_90px_48px]">
                      <GripVertical className="text-muted-foreground size-4" />
                      <div>
                        <p className="font-medium text-sm">Funding event</p>
                        <p className="text-muted-foreground text-xs">
                          Recent capital raised or announced
                        </p>
                      </div>
                      <Input className="text-center h-9" defaultValue={20} />
                      <Switch defaultChecked={true} />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center gap-4 grid-cols-[28px_1fr_90px_48px]">
                      <GripVertical className="text-muted-foreground size-4" />
                      <div>
                        <p className="font-medium text-sm">Leadership change</p>
                        <p className="text-muted-foreground text-xs">
                          New executives joining the business
                        </p>
                      </div>
                      <Input className="text-center h-9" defaultValue={15} />
                      <Switch defaultChecked={true} />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center gap-4 grid-cols-[28px_1fr_90px_48px]">
                      <GripVertical className="text-muted-foreground size-4" />
                      <div>
                        <p className="font-medium text-sm">
                          Technology adoption
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Use of relevant tools and platforms
                        </p>
                      </div>
                      <Input className="text-center h-9" defaultValue={20} />
                      <Switch defaultChecked={true} />
                    </div>
                    <div className="border-t-border border-r-border border-b border-b-border border-l-border grid pt-4 pb-4 items-center gap-4 grid-cols-[28px_1fr_90px_48px]">
                      <GripVertical className="text-muted-foreground size-4" />
                      <div>
                        <p className="font-medium text-sm">Website intent</p>
                        <p className="text-muted-foreground text-xs">
                          High-intent visits to key pages
                        </p>
                      </div>
                      <Input className="text-center h-9" defaultValue={15} />
                      <Switch defaultChecked={true} />
                    </div>
                    <button className="font-medium text-foreground text-sm flex pt-5 items-center gap-2 w-full">
                      <Plus className="size-4" />
                      Add signal question
                    </button>
                  </CardContent>
                </Card>
              </div>
              <Card className="rounded-2xl bg-card border-border pt-6 pr-6 pb-6 pl-6 gap-8">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                  <CardTitle className="text-lg">Score preview</CardTitle>
                  <CardDescription>
                    Example account scoring breakdown.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full border-t-[14px] border-t-primary border-r-[14px] border-r-primary border-b-[14px] border-b-primary border-l-[14px] border-l-primary flex justify-center items-center size-40">
                      <div className="text-center">
                        <p className="font-semibold text-4xl">78</p>
                        <p className="text-muted-foreground text-xs">
                          Example score
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <div className="text-sm flex justify-between">
                        <span>Fit</span>
                        <span className="font-medium">82</span>
                      </div>
                      <div className="rounded-full bg-muted h-2">
                        <div className="rounded-full bg-primary w-[82%] h-2" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm flex justify-between">
                        <span>Intent</span>
                        <span className="font-medium">74</span>
                      </div>
                      <div className="rounded-full bg-muted h-2">
                        <div className="rounded-full bg-primary w-[74%] h-2" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm flex justify-between">
                        <span>Timing</span>
                        <span className="font-medium">77</span>
                      </div>
                      <div className="rounded-full bg-muted h-2">
                        <div className="rounded-full bg-primary w-[77%] h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
        <div className="bg-foreground/50 flex fixed z-30 top-0 right-0 bottom-0 left-0 justify-center items-center">
          <Card className="shadow-[0px_25px_50px_-12px_rgba(0,_0,_0,_0.25)] rounded-2xl bg-card pt-6 pr-6 pb-6 pl-6 gap-6 w-[480px]">
            <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-2">
              <CardTitle className="text-xl">Add signal question</CardTitle>
              <CardDescription>
                What should we look for when qualifying an account?
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pr-0 pb-0 pl-0 gap-5">
              <div className="relative">
                <Input
                  placeholder=" "
                  className="peer pt-4 h-12"
                  defaultValue=""
                />
                <label className="pointer-events-none text-muted-foreground text-xs absolute top-1 left-3">
                  Question
                </label>
              </div>
              <Select defaultValue="Intent">
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Signal category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Intent">
                    Signal category: Intent
                  </SelectItem>
                  <SelectItem value="Fit">Signal category: Fit</SelectItem>
                  <SelectItem value="Timing">
                    Signal category: Timing
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
            <CardFooter className="pt-0 pr-0 pb-0 pl-0 justify-end gap-3">
              <Button variant="outline" className="rounded-lg">
                Cancel
              </Button>
              <Button className="rounded-lg bg-primary text-primary-foreground">
                Add question
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
