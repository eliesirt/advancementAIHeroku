import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import HomePage from "@/pages/home";
import SettingsPage from "@/pages/settings";
import InteractionsApp from "@/pages/interactions-app";
import PortfolioPage from "@/pages/portfolio";
import ItineraryPage from "@/pages/itinerary";
import UserManagementPage from "@/pages/user-management";
import Launcher from "@/pages/launcher";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import PythonAI from "@/pages/python-ai";

// Hooks
import { useAuth } from "@/hooks/useAuth";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        {isLoading || !isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/" component={Launcher} />
            <Route path="/apps/interactions" component={InteractionsApp} />
            <Route path="/apps/portfolio" component={PortfolioPage} />
            <Route path="/apps/itinerary" component={ItineraryPage} />
            <Route path="/apps/settings" component={SettingsPage} />
            <Route path="/apps/user-management" component={UserManagementPage} />
            <Route path="/apps/python-ai" component={PythonAI} />
            <Route path="/apps" component={Launcher} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>

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