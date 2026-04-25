import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { SettingsProvider } from "./lib/settings";
import { ThemeProvider } from "./lib/theme";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UpstreamBadge } from "@/components/layout/UpstreamBadge";

import Dashboard from "@/pages/dashboard";
import CreateAndAssign from "@/pages/create-and-assign";
import AssignExisting from "@/pages/assign-existing";
import AgentsBrowser from "@/pages/agents-browser";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/create" component={CreateAndAssign} />
      <Route path="/assign" component={AssignExisting} />
      <Route path="/agents" component={AgentsBrowser} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Shell() {
  const sidebarStyle = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3.25rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="kbd hidden sm:inline">⌘ B</span>
            </div>
            <div className="flex items-center gap-2">
              <UpstreamBadge />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto app-grid-bg">
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <TooltipProvider>
            <Shell />
            <Toaster />
          </TooltipProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
