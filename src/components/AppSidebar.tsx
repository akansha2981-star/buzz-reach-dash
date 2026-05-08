import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, GraduationCap, BookOpen, Settings, Sparkles, ChevronDown, Users, Calendar, ScrollText, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, perms } = useAuth();
  const isActive = (p: string) => path === p;
  const outreachOpen = path.startsWith("/outreach");
  const can = (k: keyof typeof perms) => isAdmin || perms[k];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-5 w-5 text-primary-foreground" />
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
                <Collapsible defaultOpen open className="group/collapsible">
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
