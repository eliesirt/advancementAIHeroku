import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useLocation } from "wouter";

interface AppNavigationProps {
  appName: string;
  backUrl?: string;
}

export function AppNavigation({ appName, backUrl = "/" }: AppNavigationProps) {
  const [, setLocation] = useLocation();

  const handleBackToLauncher = () => {
    setLocation(backUrl);
  };

  return (
    <>
      <ImpersonationBanner />
      <div className="bg-white border-b border-gray-200 px-4 py-3 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleBackToLauncher}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Apps</span>
            </Button>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center space-x-3">
              <img 
                src="/bu-logo.svg" 
                alt="Boston University Logo" 
                className="h-8 w-8"
              />
              <h1 className="text-lg font-semibold text-gray-900">{appName}</h1>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}