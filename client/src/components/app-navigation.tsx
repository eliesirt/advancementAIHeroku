import { Button } from "@/components/ui/button";
import { ArrowLeft, Grid3X3 } from "lucide-react";
import { useLocation } from "wouter";

interface AppNavigationProps {
  appName: string;
}

export function AppNavigation({ appName }: AppNavigationProps) {
  const [, setLocation] = useLocation();

  const handleBackToLauncher = () => {
    setLocation("/");
  };

  return (
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
          <div className="flex items-center space-x-2">
            <Grid3X3 className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900">{appName}</h1>
          </div>
        </div>
      </div>
    </div>
  );
}