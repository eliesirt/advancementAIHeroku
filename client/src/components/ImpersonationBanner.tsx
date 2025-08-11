import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserX, Crown, User } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonationStatus {
  isImpersonating: boolean;
  admin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  targetUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  startedAt?: string;
}

export function ImpersonationBanner() {
  const { toast } = useToast();

  const { data: impersonationStatus, isLoading } = useQuery<ImpersonationStatus>({
    queryKey: ["/api/admin/impersonation-status"],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/stop-impersonation");
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Impersonation Ended", 
        description: data.message 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.reload(); // Refresh to restore admin session
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to stop impersonation", 
        variant: "destructive" 
      });
    },
  });

  if (isLoading || !impersonationStatus?.isImpersonating) {
    return null;
  }

  return (
    <Alert className="border-orange-200 bg-orange-50 text-orange-900 rounded-none border-b-4" style={{ borderBottomColor: '#f97316' }}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-3">
          <UserX className="h-5 w-5 text-orange-600" />
          <AlertDescription className="text-sm font-medium">
            <span className="flex items-center space-x-2">
              <Crown className="h-4 w-4" />
              <span>Admin Impersonation Active:</span>
              <span className="font-semibold text-orange-800">
                Running as {impersonationStatus.targetUser?.firstName} {impersonationStatus.targetUser?.lastName}
              </span>
              <span className="text-xs text-orange-700">
                ({impersonationStatus.targetUser?.email})
              </span>
            </span>
          </AlertDescription>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-orange-700">
            Admin: {impersonationStatus.admin?.firstName} {impersonationStatus.admin?.lastName}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stopImpersonationMutation.mutate()}
            disabled={stopImpersonationMutation.isPending}
            className="border-orange-300 text-orange-800 hover:bg-orange-100 hover:border-orange-400"
          >
            <User className="h-4 w-4 mr-2" />
            Exit Impersonation
          </Button>
        </div>
      </div>
    </Alert>
  );
}