import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut, User, Settings, Brain, Zap, Users, Database, Briefcase, Map, Code } from "lucide-react";
import type { ApplicationWithPermissions, UserWithRoles } from "@shared/schema";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export default function Launcher() {
  const { user } = useAuth() as { user: UserWithRoles | undefined };

  const { data: applications, isLoading } = useQuery<ApplicationWithPermissions[]>({
    queryKey: ["/api/applications"],
    enabled: !!user,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleLaunchApp = (route: string) => {
    window.location.href = route;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" style={{ color: '#CC0000' }} />
          <span className="text-lg text-gray-700">Loading AdvancementAI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Impersonation Banner */}
      <ImpersonationBanner />
      
      {/* Header */}
      <header className="bg-white shadow-lg border-b-4" style={{ borderBottomColor: '#CC0000' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img
                src="/bu-logo.svg"
                alt="Boston University Logo"
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold" style={{ color: '#CC0000' }}>AdvancementAI</h1>
                <p className="text-sm text-gray-600 font-medium">Boston University Advancement Technology Suite</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email
                  }
                </div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2 border-gray-300 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              AI-Powered Advancement Tools
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Empowering fundraising excellence through intelligent technology that supports
              <span className="font-semibold"> outstanding engagement</span>,
              <span className="font-semibold"> strategic insights</span>, and
              <span className="font-semibold"> meaningful connections</span>.
            </p>
            <div className="flex justify-center items-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4" style={{ color: '#CC0000' }} />
                <span>AI-Enhanced</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" style={{ color: '#CC0000' }} />
                <span>Relationship-Focused</span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4" style={{ color: '#CC0000' }} />
                <span>Data-Driven</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {(() => {
          const sortedApps = (applications || [])
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          
          // Group applications
          const applicationApps = sortedApps.filter(app => 
            ['interaction-manager', 'portfolio-ai', 'itinerary-ai'].includes(app.name)
          );
          
          const administrationApps = sortedApps.filter(app => 
            ['python-ai', 'settings', 'user-management'].includes(app.name)
          );

          const renderAppCard = (app: ApplicationWithPermissions) => (
            <Card key={app.id} className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-red-200 bg-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100" style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' }}>
                    <div className="h-8 w-8 flex items-center justify-center" style={{ color: '#CC0000' }}>
                      {app.icon === 'users' && <Users className="h-6 w-6" />}
                      {app.icon === 'settings' && <Settings className="h-6 w-6" />}
                      {app.icon === 'briefcase' && <Briefcase className="h-6 w-6" />}
                      {app.icon === 'map' && <Map className="h-6 w-6" />}
                      {app.icon === 'code' && <Code className="h-6 w-6" />}
                      {!app.icon && <Brain className="h-6 w-6" />}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {app.permissions?.includes('admin') && (
                      <div className="px-2 py-1 text-xs font-medium text-white rounded-full" style={{ backgroundColor: '#CC0000' }}>
                        Admin
                      </div>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-red-700 transition-colors">
                  {app.displayName}
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 leading-relaxed">
                  {app.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={() => handleLaunchApp(app.route)}
                  className="w-full font-semibold text-white transition-all duration-200 hover:shadow-lg"
                  style={{ backgroundColor: '#CC0000' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B30000'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#CC0000'}
                >
                  Launch Application
                </Button>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>Permissions: {app.permissions?.join(', ') || 'read'}</span>
                  <span className="text-green-600">● Active</span>
                </div>
              </CardContent>
            </Card>
          );

          return (
            <>
              {/* Applications Section */}
              <div className="mb-12">
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Applications</h3>
                  <p className="text-gray-600">AI-powered advancement tools for fundraising excellence</p>
                </div>

                {/* Applications Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {applicationApps.map(renderAppCard)}
                </div>
              </div>

              {/* Administration Section */}
              <div className="mb-12">
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Administration</h3>
                  <p className="text-gray-600">System settings, user management, and development tools</p>
                </div>

                {/* Administration Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {administrationApps.map(renderAppCard)}
                </div>
              </div>

              {(applications || []).length === 0 && (
                <div className="text-center py-16">
                  <div className="mb-6">
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center">
                      <Brain className="h-10 w-10" style={{ color: '#CC0000' }} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No Applications Available</h3>
                  <p className="text-lg text-gray-600 max-w-md mx-auto">
                    Contact your administrator to get access to AdvancementAI applications and start leveraging AI-powered advancement tools.
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </main>
    </div>
  );
}