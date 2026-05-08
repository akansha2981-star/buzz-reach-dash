import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileQuickActionFAB } from "./MobileQuickActionFAB";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader title={title} />
          <main
            className="min-w-0 flex-1 p-3 pb-20 sm:p-4 md:p-6 md:pb-6 lg:p-8"
          >
            {children}
          </main>
        </div>
        <MobileQuickActionFAB />
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
