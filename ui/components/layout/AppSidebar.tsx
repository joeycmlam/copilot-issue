"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDot,
  Bot,
  GitBranch,
  LayoutDashboard,
  Settings as SettingsIcon,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/brand/Logo";
import { useSettings } from "@/lib/settings";

const NAV_MAIN = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    testId: "nav-dashboard",
    matchFn: (loc: string) => loc === "/dashboard" || loc.startsWith("/dashboard/"),
  },
  {
    title: "Issues",
    url: "/issues",
    icon: CircleDot,
    testId: "nav-issues",
    // also active on root
    matchFn: (loc: string) => loc === "/" || loc === "" || loc === "/issues",
  },
  {
    title: "New issue (advanced)",
    url: "/create",
    icon: Plus,
    testId: "nav-create",
    matchFn: (loc: string) => loc === "/create" || loc.startsWith("/create/"),
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
    testId: "nav-agents",
    matchFn: (loc: string) => loc === "/agents" || loc.startsWith("/agents/"),
  },
  {
    title: "Assign existing",
    url: "/assign",
    icon: GitBranch,
    testId: "nav-assign",
    matchFn: (loc: string) => loc === "/assign" || loc.startsWith("/assign/"),
  },
] as const;

export function AppSidebar() {
  const location = usePathname() ?? "/";
  const { settings } = useSettings();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-2">
          <Logo withWordmark />
          <span className="kbd text-[10px]" data-testid="text-version">v0.1</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.matchFn(location)}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Default repo</SidebarGroupLabel>
          <SidebarGroupContent>
            <div
              className="px-2 py-1 font-mono text-xs text-sidebar-foreground/80"
              data-testid="text-default-repo"
            >
              {settings.defaultOwner && settings.defaultRepo
                ? `${settings.defaultOwner}/${settings.defaultRepo}`
                : "— not set —"}
            </div>
            <div className="px-2 pb-2 font-mono text-[11px] text-sidebar-foreground/60">
              branch:{" "}
              <span className="text-sidebar-foreground/80">
                {settings.defaultBaseBranch || "main"}
              </span>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              data-testid="nav-settings"
            >
              <Link href="/settings">
                <SettingsIcon />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="link-github-docs">
              <a
                href="https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-custom-agents"
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink />
                <span>Custom agents docs</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
