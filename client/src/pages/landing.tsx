import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Application Suite
          </h1>
          <p className="text-gray-600">
            Please sign in to access your applications
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to access the application suite and manage your interactions, settings, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleLogin}
              className="w-full"
              size="lg"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-gray-500">
          Secure authentication powered by your organization's identity provider
        </div>
      </div>
    </div>
  );
}