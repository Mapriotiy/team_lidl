import { useNavigate } from "react-router-dom";
import {
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import "./d040bf0a-0dca-417a-8bb6-50234e10c49a.css";
import "./Screen-9.screen.css";

export default function Screen9() {
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
              <a
                className="rounded-xl text-muted-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11"
                onClick={() => navigate("/screen-8")}
              >
                <BarChart3 />
                <span>Reports</span>
              </a>
              <a className="rounded-xl bg-primary text-primary-foreground text-sm flex pr-3 pl-3 items-center gap-3 h-11">
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
              <h1 className="font-semibold text-lg">Settings</h1>
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
          <main className="flex ml-[248px] pt-28 pr-12 pb-12 pl-12 gap-12 min-h-screen">
            <Tabs className="shrink-0 w-48" defaultValue="general">
              <TabsList className="bg-transparent flex pt-0 pr-0 pb-0 pl-0 flex-col items-stretch gap-1 h-auto">
                <TabsTrigger
                  value="general"
                  className="rounded-xl text-sm pt-3 pr-4 pb-3 pl-4 justify-start"
                >
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="team"
                  className="rounded-xl text-sm pt-3 pr-4 pb-3 pl-4 justify-start"
                >
                  Team
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="rounded-xl text-sm pt-3 pr-4 pb-3 pl-4 justify-start"
                >
                  Notifications
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="rounded-xl text-sm pt-3 pr-4 pb-3 pl-4 justify-start"
                >
                  Billing
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="rounded-xl text-sm pt-3 pr-4 pb-3 pl-4 justify-start"
                >
                  Security
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col flex-1 gap-6 max-w-3xl">
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-2xl tracking-tight">
                  Settings
                </h2>
                <p className="text-muted-foreground text-sm">
                  Manage your workspace preferences and account settings.
                </p>
              </div>
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                  <CardTitle className="text-lg">General</CardTitle>
                  <CardDescription>
                    Update your workspace details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-5">
                  <div className="relative">
                    <Input
                      className="rounded-xl pt-3 pr-4 pl-4 h-12"
                      defaultValue="Acme Revenue Team"
                    />
                    <label className="-translate-y-1/2 bg-card text-muted-foreground text-xs absolute top-0 left-3 pr-1 pl-1">
                      Workspace name
                    </label>
                  </div>
                  <div className="relative">
                    <Input
                      className="rounded-xl pt-3 pr-4 pl-4 h-12"
                      defaultValue="acme-revenue"
                    />
                    <label className="-translate-y-1/2 bg-card text-muted-foreground text-xs absolute top-0 left-3 pr-1 pl-1">
                      Workspace URL
                    </label>
                  </div>
                  <Select defaultValue="est">
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="est">
                        (GMT-05:00) Eastern Time
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
                <CardFooter className="pt-0 pr-0 pb-0 pl-0">
                  <Button className="rounded-xl bg-primary text-primary-foreground pr-5 pl-5">
                    Save changes
                  </Button>
                </CardFooter>
              </Card>
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                  <CardTitle className="text-lg">Team</CardTitle>
                  <CardDescription>
                    Manage members of your workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>AM</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">Alex Morgan</p>
                        <p className="text-muted-foreground text-xs">Admin</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>JL</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">Jordan Lee</p>
                        <p className="text-muted-foreground text-xs">Member</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>PS</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">Priya Shah</p>
                        <p className="text-muted-foreground text-xs">Member</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 pr-0 pb-0 pl-0">
                  <Button className="rounded-xl bg-primary text-primary-foreground pr-5 pl-5">
                    Invite member
                  </Button>
                </CardFooter>
              </Card>
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>
                    Choose which updates you receive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 flex-col gap-5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">New high-intent signals</span>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Weekly pipeline digest</span>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Sequence replies</span>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Product updates</span>
                    <Switch defaultChecked={false} />
                  </div>
                </CardContent>
              </Card>
              <Card className="pt-6 pr-6 pb-6 pl-6 gap-6">
                <CardHeader className="pt-0 pr-0 pb-0 pl-0 gap-1">
                  <CardTitle className="text-lg">Billing</CardTitle>
                  <CardDescription>
                    Review your plan and billing details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex pt-0 pr-0 pb-0 pl-0 justify-between items-center">
                  <div className="flex flex-col gap-2">
                    <p className="font-medium text-base">Growth plan</p>
                    <p className="font-semibold text-2xl">
                      $499
                      <span className="font-normal text-muted-foreground text-sm">
                        / month
                      </span>
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Next invoice Jun 1, 2024
                    </p>
                  </div>
                  <Button variant="ghost" className="rounded-xl">
                    Manage billing
                  </Button>
                </CardContent>
              </Card>
              <div className="rounded-xl border-t border-t-destructive/30 border-r border-r-destructive/30 border-b border-b-destructive/30 border-l border-l-destructive/30 flex pt-5 pr-5 pb-5 pl-5 justify-between items-center">
                <div className="relative">
                  <div className="whitespace-nowrap rounded-lg bg-foreground text-background text-xs absolute bottom-full left-0 mb-2 pt-2 pr-3 pb-2 pl-3">
                    Only workspace owners can delete a workspace.
                  </div>
                  <p className="font-medium text-sm">Delete workspace</p>
                </div>
                <Button
                  variant="destructive"
                  disabled={true}
                  className="rounded-xl"
                >
                  Delete workspace
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
