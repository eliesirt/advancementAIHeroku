import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import HomePage from "@/pages/home";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

// Components
import { BottomNavigation } from "@/components/bottom-navigation";
import { DrivingMode } from "@/components/driving-mode";

// Hooks
import { useQuery } from "@tanstack/react-query";

function AppContent() {
  const [location, navigate] = useLocation();
  const [isDrivingMode, setIsDrivingMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Get current page from location
  const currentPage = location === "/" ? "home" : location.replace("/", "");

  // Fetch pending interactions count for navigation badge
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleNavigate = (page: string) => {
    if (page === "home") {
      navigate("/");
    } else {
      navigate(`/${page}`);
    }
  };

  const handleDrivingModeToggle = () => {
    setIsDrivingMode(!isDrivingMode);
  };

  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleSubmitInteraction = () => {
    // This would be handled by the individual page components
    console.log("Submit interaction from driving mode");
  };

  const handleShowHistory = () => {
    setIsDrivingMode(false);
    navigate("/history");
  };

  const handleShowSettings = () => {
    setIsDrivingMode(false);
    navigate("/settings");
  };

  // Prevent scrolling when driving mode is active
  useEffect(() => {
    if (isDrivingMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isDrivingMode]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="pb-16"> {/* Account for bottom navigation */}
        <Switch>
          <Route path="/" component={() => 
            <HomePage 
              onDrivingModeToggle={handleDrivingModeToggle}
              isDrivingMode={isDrivingMode}
            />
          } />
          <Route path="/history" component={HistoryPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </div>

      {/* Bottom Navigation */}
      {!isDrivingMode && (
        <BottomNavigation
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />
      )}

      {/* Driving Mode Overlay */}
      <DrivingMode
        isActive={isDrivingMode}
        onExit={() => setIsDrivingMode(false)}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onSubmitInteraction={handleSubmitInteraction}
        onShowHistory={handleShowHistory}
        onShowSettings={handleShowSettings}
      />

      {/* Global Toast Notifications */}
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
