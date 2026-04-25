import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Sparkles,
  GitBranch,
  Users,
  Settings as SettingsIcon,
  ExternalLink,
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
} from "@/components/ui/sidebar";
import { Logo } from "@/components/brand/Logo";
import { useSettings } from "@/lib/settings";

const NAV = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, testId: "nav-dashboard" },
  { title: "Create & assign", url: "/create", icon: Sparkles, testId: "nav-create" },
  { title: "Assign existing", url: "/assign", icon: GitBranch, testId: "nav-assign" },
  { title: "Agents", url: "/agents", icon: Users, testId: "nav-agents" },
] as const;

export function AppSidebar() {
  const [location] = useLocation();
  const { settings } = useSettings();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-2">
          <Logo withWordmark />
          <span className="kbd" data-testid="text-version">v0.1</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  item.url === "/"
                    ? location === "/" || location === ""
                    : location === item.url || location.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} data-testid={item.testId}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Default repo</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-1.5 font-mono text-xs text-sidebar-foreground/80" data-testid="text-default-repo">
              {settings.defaultOwner && settings.defaultRepo
                ? `${settings.defaultOwner}/${settings.defaultRepo}`
                : "— not set —"}
            </div>
            <div className="px-2 pb-2 font-mono text-[11px] text-sidebar-foreground/60">
              base: <span className="text-sidebar-foreground/80">{settings.defaultBaseBranch || "main"}</span>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="nav-settings">
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
