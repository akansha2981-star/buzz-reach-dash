import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, GraduationCap, BookOpen, Settings, Sparkles, ChevronDown, Users, Calendar, ScrollText, Activity, ListChecks, Crown, FolderOpen, Clock, CalendarDays, ClipboardList, TrendingUp, Megaphone, BarChart3, Shield, ShieldCheck, UserCog, User as UserIcon, Sun, CheckSquare, Timer, Target, LineChart, Wallet, FileText, Receipt, Repeat, Landmark } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Badge } from "@/components/ui/badge";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";
import { useAuth } from "@/lib/auth";
import { useMyEmployee, isHRAdminRole } from "@/lib/hr";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logo from "@/assets/logo.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, perms, user } = useAuth();
  const { data: meHR } = useMyEmployee();
  const showHRAdmin = isAdmin || isHRAdminRole(meHR?.hr_role);
  const { pendingCount, overdueCount } = useTaskNotifications();
  useRealtime("ceo_desk_requests", [["ceo-desk-badge"]]);
  const { data: ceoOpen = 0 } = useQuery({
    queryKey: ["ceo-desk-badge", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("ceo_desk_requests").select("id", { count: "exact", head: true }).neq("status", "closed");
      if (!isAdmin) q = q.eq("requester_id", user!.id);
      const { count } = await q;
      return count ?? 0;
    },
  });
  const isActive = (p: string) => path === p;
  const can = (k: keyof typeof perms) => isAdmin || perms[k];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-white">
            <img src={logo} alt="Works by B School Buzz" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight font-display">Works</span>
              <span className="text-xs text-muted-foreground leading-tight">B School Buzz</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {can("can_dashboard") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/")}>
                    <Link to="/"><LayoutDashboard /><span>Dashboard</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {(can("can_colleges") || can("can_coaching")) && (
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <GraduationCap />
                        <span>Outreach</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {can("can_colleges") && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/outreach/colleges")}>
                              <Link to="/outreach/colleges"><GraduationCap className="h-4 w-4" /><span>Colleges</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        {can("can_coaching") && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/outreach/coaching")}>
                              <Link to="/outreach/coaching"><BookOpen className="h-4 w-4" /><span>Coaching</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        {can("can_timeline") && (can("can_colleges") || can("can_coaching")) && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isActive("/outreach/timeline")}>
                              <Link to="/outreach/timeline"><Activity className="h-4 w-4" /><span>Timeline</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {can("can_meetings") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/meetings")}>
                    <Link to="/meetings"><Calendar /><span>Meetings</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {can("can_tasks") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/tasks")}>
                    <Link to="/tasks">
                      <ListChecks />
                      <span>Tasks</span>
                      {pendingCount > 0 && !collapsed && (
                        <Badge variant={overdueCount > 0 ? "destructive" : "secondary"} className="ml-auto h-5 px-1.5 text-[10px]">
                          {pendingCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {can("can_documents") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/documents")}>
                    <Link to="/documents"><FolderOpen /><span>Documents</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {can("can_my_workspace") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/me")}>
                    <Link to="/me"><Sparkles /><span>My Workspace</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {can("can_my_workspace") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/habits")}>
                    <Link to="/habits"><Target /><span>Habits</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {can("can_accounts") && (
                <Collapsible defaultOpen={path.startsWith("/accounts")} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <Wallet />
                        <span>Accounts</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/accounts/invoices")}>
                            <Link to="/accounts/invoices"><FileText className="h-4 w-4" /><span>Invoice Management</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/accounts/expenses")}>
                            <Link to="/accounts/expenses"><Receipt className="h-4 w-4" /><span>Expenses</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/accounts/recurring")}>
                            <Link to="/accounts/recurring"><Repeat className="h-4 w-4" /><span>Recurring Monthly</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/accounts/clients")}>
                            <Link to="/accounts/clients"><Users className="h-4 w-4" /><span>Permanent Clients</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>

                  </SidebarMenuItem>
                </Collapsible>
              )}

              {can("can_my_workspace") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/me/confidential")}>
                    <Link to="/me/confidential"><ShieldCheck /><span>Confidential</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {can("can_ceo_desk") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/ceo-desk")}>
                    <Link to="/ceo-desk">
                      <Crown />
                      <span>{isAdmin ? "CEO Desk" : "My CEO Requests"}</span>
                      {ceoOpen > 0 && !collapsed && (
                        <Badge variant="default" className="ml-auto h-5 bg-amber-500 px-1.5 text-[10px] hover:bg-amber-500">
                          {ceoOpen}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>HR</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen={path.startsWith("/hrms") && !path.startsWith("/hrms/admin")} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <UserIcon />
                      <span>HR · Me</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms")}>
                          <Link to="/hrms"><LayoutDashboard className="h-4 w-4" /><span>My Report</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/attendance")}>
                          <Link to="/hrms/attendance"><Clock className="h-4 w-4" /><span>Login / Logout</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/leaves")}>
                          <Link to="/hrms/leaves"><CalendarDays className="h-4 w-4" /><span>My Leaves</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/announcements")}>
                          <Link to="/hrms/announcements"><Megaphone className="h-4 w-4" /><span>Important Updates</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/me")}>
                          <Link to="/hrms/me"><FolderOpen className="h-4 w-4" /><span>My Documents</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {showHRAdmin && (
                <Collapsible defaultOpen={path.startsWith("/hrms/admin") || path.startsWith("/hrms/employees")} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <UserCog />
                        <span>HR · Admin</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/employees")}>
                            <Link to="/hrms/employees"><Users className="h-4 w-4" /><span>Employees</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/admin/leaves")}>
                            <Link to="/hrms/admin/leaves"><ClipboardList className="h-4 w-4" /><span>Leave Approvals</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/admin/attendance")}>
                            <Link to="/hrms/admin/attendance"><Activity className="h-4 w-4" /><span>Org Attendance</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/productivity")}>
                            <Link to="/hrms/productivity"><TrendingUp className="h-4 w-4" /><span>Productivity</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/tasks")}>
                            <Link to="/hrms/tasks"><ListChecks className="h-4 w-4" /><span>HR Tasks</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/admin/analytics")}>
                            <Link to="/hrms/admin/analytics"><BarChart3 className="h-4 w-4" /><span>Analytics</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/hrms/admin/audit")}>
                            <Link to="/hrms/admin/audit"><Shield className="h-4 w-4" /><span>Audit Log</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {(can("can_users") || can("can_stages") || can("can_logs")) && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {can("can_users") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/settings/users")}>
                      <Link to="/settings/users"><Users /><span>Users</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {can("can_stages") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/settings/stages")}>
                      <Link to="/settings/stages"><Settings /><span>Stage Settings</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {can("can_logs") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/settings/logs")}>
                      <Link to="/settings/logs"><ScrollText /><span>Activity Logs</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border" />
    </Sidebar>
  );
}
