import { EnvVarWarning } from "@/components/env-var-warning";
import { UserInfo } from "@/components/user-info";
import { WorkspaceName } from "@/components/workspace-name";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/sidebar-context";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { AvatarCleanup } from "@/components/avatar-cleanup";
import { WorkspaceEnsure } from "@/components/workspace-ensure";
import { PasswordChangeRequiredCheck } from "@/components/password-change-required-check";
import { ActivitiesProvider } from "@/components/activities-context";
import { ActivitiesPanel } from "@/components/activities-panel";
import { ActivitiesToggle } from "@/components/activities-toggle";
import { ActivitiesContentWrapper } from "@/components/activities-content-wrapper";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BreadcrumbsProvider } from "@/components/breadcrumbs-context";
import { hasEnvVars } from "@/lib/utils";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <ActivitiesProvider>
        <BreadcrumbsProvider>
          <AvatarCleanup />
          <WorkspaceEnsure />
          <PasswordChangeRequiredCheck />
        <div className="min-h-screen flex overflow-x-hidden">
          <Suspense
            fallback={
              <aside className="fixed md:static w-64 min-h-screen bg-background border-r border-border flex flex-col shrink-0">
                <div className="flex justify-end p-4">
                  <div className="h-9 w-9 bg-muted animate-pulse rounded" />
              </div>
                <nav className="flex-1 px-4 pb-4 space-y-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
                  ))}
                </nav>
              </aside>
            }
          >
            <Sidebar />
          </Suspense>
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden relative">
            <nav className="w-full border-b border-border h-16 bg-background shrink-0">
              <div className="w-full h-full flex justify-between items-center px-4 md:px-5 gap-4">
                {/* Lado izquierdo - Botón hamburguesa, toggle de actividades y Workspace */}
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  <SidebarToggle />
                  <ActivitiesToggle />
                  
                  {/* Workspace */}
                  <div className="hidden md:block">
                    <Suspense
                      fallback={
                        <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
                      }
                    >
                      <WorkspaceName />
                    </Suspense>
                  </div>
                </div>

                {/* Lado derecho - Información del usuario */}
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  {!hasEnvVars ? (
                    <EnvVarWarning />
                  ) : (
                    <Suspense
                      fallback={
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                          <div className="h-4 w-20 md:w-24 bg-muted animate-pulse rounded hidden sm:block" />
                        </div>
                      }
                    >
                      <UserInfo />
                    </Suspense>
                  )}
                </div>
              </div>
            </nav>
            <Suspense
              fallback={
                <div className="w-full border-b border-border bg-background/95 h-10">
                  <div className="flex h-10 items-center gap-2 px-4 md:px-5">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              }
            >
              <Breadcrumbs />
            </Suspense>
            <div className="flex-1 flex overflow-x-hidden relative">
              <ActivitiesPanel />
              <ActivitiesContentWrapper>
          {children}
              </ActivitiesContentWrapper>
            </div>
          </div>
        </div>
        </BreadcrumbsProvider>
      </ActivitiesProvider>
    </SidebarProvider>
  );
}
