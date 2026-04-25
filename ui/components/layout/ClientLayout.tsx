"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { SettingsProvider } from "@/lib/settings";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UpstreamBadge } from "@/components/layout/UpstreamBadge";

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3.25rem",
} as React.CSSProperties;

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <TooltipProvider>
            <SidebarProvider style={sidebarStyle}>
              <div className="flex h-screen w-full bg-background">
                <AppSidebar />
                <div className="flex flex-1 flex-col min-w-0">
                  <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                    </div>
                    <div className="flex items-center gap-2">
                      <UpstreamBadge />
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 overflow-y-auto app-grid-bg">
                    {children}
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
