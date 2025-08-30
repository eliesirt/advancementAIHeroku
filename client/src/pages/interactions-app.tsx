import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AppNavigation } from "@/components/app-navigation";
import { DrivingMode } from "@/components/driving-mode";
import HomePage from "./home";

export default function InteractionsApp() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [isDrivingMode, setIsDrivingMode] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const handleDrivingModeToggle = () => {
    setIsDrivingMode(prev => !prev);
  };

  const handleDrivingModeExit = () => {
    setIsDrivingMode(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation appName="interactionAI" />
      <HomePage 
        onDrivingModeToggle={handleDrivingModeToggle} 
        isDrivingMode={isDrivingMode} 
      />
      
      {/* Driving Mode Overlay */}
      <DrivingMode
        isActive={isDrivingMode}
        onExit={handleDrivingModeExit}
        onStartRecording={() => {
          // TODO: Implement voice recording functionality for driving mode
          toast({
            title: "Voice Recording",
            description: "Starting voice recording in driving mode",
          });
        }}
        onStopRecording={() => {
          // TODO: Implement stop recording functionality
          toast({
            title: "Voice Recording",
            description: "Stopping voice recording",
          });
        }}
        onSubmitInteraction={() => {
          // TODO: Implement interaction submission
          toast({
            title: "Interaction Submit",
            description: "Submitting interaction to Blackbaud CRM",
          });
        }}
        onShowSettings={() => {
          // TODO: Implement settings navigation in driving mode
          toast({
            title: "Settings",
            description: "Opening settings panel",
          });
        }}
      />
    </div>
  );
}