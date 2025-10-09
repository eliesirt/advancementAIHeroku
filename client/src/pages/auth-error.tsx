import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AuthError() {
  const [, setLocation] = useLocation();
  
  // Parse error from URL query params
  const params = new URLSearchParams(window.location.search);
  const errorMessage = params.get('error') || 'An unknown authentication error occurred';
  const tenant = params.get('tenant');

  const handleRetry = () => {
    if (tenant) {
      window.location.href = `/api/auth/login/${tenant}`;
    } else {
      window.location.href = '/api/login';
    }
  };

  const handleGoHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Authentication Error
          </h1>
          <p className="text-gray-600">
            We encountered an issue signing you in
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>What happened?</CardTitle>
            <CardDescription>
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMessage.includes('admin approval') || errorMessage.includes('consent') ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">Need Admin Approval</p>
                <p>This application requires administrator consent before you can use it. Please contact your IT administrator to grant access.</p>
              </div>
            ) : null}
            
            <div className="flex gap-3">
              <Button 
                onClick={handleRetry}
                className="flex-1"
                data-testid="button-retry-login"
              >
                Try Again
              </Button>
              <Button 
                onClick={handleGoHome}
                variant="outline"
                className="flex-1"
                data-testid="button-go-home"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-gray-500">
          If this issue persists, please contact your system administrator
        </div>
      </div>
    </div>
  );
}
