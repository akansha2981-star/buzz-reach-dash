import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, GraduationCap, BookOpen, Settings, Sparkles, ChevronDown, Users, Calendar, ScrollText, Activity, ListChecks, Crown, FolderOpen, Briefcase, Clock, CalendarDays, ClipboardList, TrendingUp, Megaphone, BarChart3, Shield, FileText, UserCog, User as UserIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Badge } from "@/components/ui/badge";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";
import { useAuth } from "@/lib/auth";
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
                        {(can("can_colleges") || can("can_coaching")) && (
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

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/documents")}>
                  <Link to="/documents"><FolderOpen /><span>Documents</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>HR</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen={path.startsWith("/hrms")} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Briefcase />
                      <span>HRMS</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms")}>
                          <Link to="/hrms"><LayoutDashboard className="h-4 w-4" /><span>Dashboard</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/attendance")}>
                          <Link to="/hrms/attendance"><Clock className="h-4 w-4" /><span>Attendance</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/leaves")}>
                          <Link to="/hrms/leaves"><CalendarDays className="h-4 w-4" /><span>Leaves</span></Link>
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
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/announcements")}>
                          <Link to="/hrms/announcements"><Megaphone className="h-4 w-4" /><span>Announcements</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/employees")}>
                          <Link to="/hrms/employees"><Users className="h-4 w-4" /><span>Employees</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/admin/leaves")}>
                          <Link to="/hrms/admin/leaves"><ClipboardList className="h-4 w-4" /><span>Approvals</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive("/hrms/admin/attendance")}>
                          <Link to="/hrms/admin/attendance"><Activity className="h-4 w-4" /><span>Org Attendance</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
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
