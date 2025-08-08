import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut, User, Settings } from "lucide-react";
import type { ApplicationWithPermissions, UserWithRoles } from "@shared/schema";

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading applications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Application Suite</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.firstName || user?.email}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your Applications</h2>
          <p className="text-gray-600">Select an application to get started</p>
        </div>

        {/* Applications Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(applications || []).map((app: ApplicationWithPermissions) => (
            <Card key={app.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg bg-${app.color || 'blue'}-100`}>
                    <div className={`h-6 w-6 text-${app.color || 'blue'}-600 flex items-center justify-center`}>
                      {app.icon === 'users' && <User className="h-5 w-5" />}
                      {app.icon === 'settings' && <Settings className="h-5 w-5" />}
                      {!app.icon && <div className="h-5 w-5 bg-gray-400 rounded" />}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {app.permissions?.includes('admin') && '👑'}
                    {app.permissions?.includes('write') && '✏️'}
                    {app.permissions?.includes('read') && '👁️'}
                  </div>
                </div>
                <CardTitle className="text-lg">{app.displayName}</CardTitle>
                <CardDescription className="text-sm">
                  {app.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => handleLaunchApp(app.route)}
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
                  variant="outline"
                >
                  Launch App
                </Button>
                <div className="mt-2 text-xs text-gray-500">
                  Access: {app.permissions?.join(', ') || 'read'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {(applications || []).length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Settings className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Available</h3>
            <p className="text-gray-600">
              Contact your administrator to get access to applications.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}