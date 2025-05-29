import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mic, 
  Car, 
  Edit, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  TrendingUp
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Components
import { VoiceRecorder } from "@/components/voice-recorder";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { InteractionForm } from "@/components/interaction-form";

// Types
import type { Interaction } from "@shared/schema";

interface HomePageProps {
  onDrivingModeToggle: () => void;
  isDrivingMode: boolean;
}

interface ExtractedInfo {
  prospectName?: string;
  summary: string;
  category: string;
  subcategory: string;
  professionalInterests: string[];
  personalInterests: string[];
  philanthropicPriorities: string[];
  keyPoints: string[];
  suggestedAffinityTags: string[];
}

export default function HomePage({ onDrivingModeToggle, isDrivingMode }: HomePageProps) {
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [enhancedComments, setEnhancedComments] = useState("");

  const { toast } = useToast();

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent interactions
  const { data: recentInteractions = [] } = useQuery<Interaction[]>({
    queryKey: ["/api/interactions/recent"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create voice recording mutation
  const createVoiceRecording = useMutation({
    mutationFn: async (data: { audioData: string; duration: number; transcript: string }) => {
      const response = await apiRequest("POST", "/api/voice-recordings", data);
      return response.json();
    },
    onSuccess: (recording) => {
      // Process the recording
      processVoiceRecording.mutate(recording.id);
    },
    onError: (error) => {
      toast({
        title: "Recording Error",
        description: "Failed to save voice recording. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Process voice recording mutation
  const processVoiceRecording = useMutation({
    mutationFn: async (recordingId: number) => {
      const response = await apiRequest("POST", `/api/voice-recordings/${recordingId}/process`);
      return response.json();
    },
    onSuccess: async (data) => {
      setCurrentTranscript(data.transcript);
      setExtractedInfo(data.extractedInfo);
      
      // Enhance comments
      try {
        const enhanceResponse = await apiRequest("POST", "/api/interactions/enhance-comments", {
          transcript: data.transcript,
          extractedInfo: data.extractedInfo
        });
        const { enhancedComments } = await enhanceResponse.json();
        setEnhancedComments(enhancedComments);
      } catch (error) {
        console.error("Failed to enhance comments:", error);
      }

      setShowProcessing(false);
      setShowInteractionForm(true);
    },
    onError: (error) => {
      setShowProcessing(false);
      toast({
        title: "Processing Error",
        description: "Failed to process voice recording. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create interaction mutation
  const createInteraction = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/interactions", {
        ...data,
        isDraft: false
      });
      return response.json();
    },
    onSuccess: (interaction) => {
      // Submit to BBEC
      submitToBBEC.mutate(interaction.id);
    },
    onError: (error) => {
      toast({
        title: "Submission Error",
        description: "Failed to create interaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Submit to BBEC mutation
  const submitToBBEC = useMutation({
    mutationFn: async (interactionId: number) => {
      const response = await apiRequest("POST", `/api/interactions/${interactionId}/submit-bbec`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Interaction successfully submitted to Blackbaud CRM",
      });
      
      // Reset form state
      setShowInteractionForm(false);
      setCurrentTranscript("");
      setExtractedInfo(null);
      setEnhancedComments("");
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "BBEC Submission Error",
        description: "Failed to submit to Blackbaud CRM. The interaction was saved as a draft.",
        variant: "destructive",
      });
    },
  });

  // Save draft mutation
  const saveDraft = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/interactions", {
        ...data,
        isDraft: true
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft Saved",
        description: "Interaction saved as draft. You can complete it later.",
      });
      
      setShowInteractionForm(false);
      setCurrentTranscript("");
      setExtractedInfo(null);
      setEnhancedComments("");
    },
    onError: (error) => {
      toast({
        title: "Save Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVoiceRecordingComplete = (audioData: string, transcript: string, duration: number) => {
    setShowVoiceRecorder(false);
    setShowProcessing(true);
    
    createVoiceRecording.mutate({
      audioData,
      transcript,
      duration
    });
  };

  const handleInteractionSubmit = (data: any) => {
    createInteraction.mutate(data);
  };

  const handleSaveDraft = (data: any) => {
    saveDraft.mutate(data);
  };

  const formatTimeAgo = (date: string | Date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  const getStatusColor = (interaction: Interaction) => {
    if (interaction.bbecSubmitted) return "text-green-600";
    if (interaction.isDraft) return "text-yellow-600";
    return "text-blue-600";
  };

  const getStatusIcon = (interaction: Interaction) => {
    if (interaction.bbecSubmitted) return <CheckCircle className="h-3 w-3" />;
    if (interaction.isDraft) return <Edit className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  const getStatusText = (interaction: Interaction) => {
    if (interaction.bbecSubmitted) return "Synced";
    if (interaction.isDraft) return "Draft";
    return "Pending";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6" />
            <div>
              <div className="font-medium text-sm">{user?.name || "Loading..."}</div>
              <div className="text-xs opacity-90">{user?.role || ""}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDrivingModeToggle}
              className="text-white hover:bg-primary-dark p-2"
            >
              <Car className="h-5 w-5" />
            </Button>
            <div className="w-2 h-2 bg-green-400 rounded-full" title="Connected to BBEC" />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">
                {stats?.todayInteractions || 0}
              </div>
              <div className="text-sm text-gray-600">Today</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {stats?.thisWeekInteractions || 0}
              </div>
              <div className="text-sm text-gray-600">This Week</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.pendingInteractions || 0}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
        </div>

        {/* SOP Compliance Reminder */}
        {stats?.pendingInteractions > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <div className="font-medium">48-Hour Entry Reminder</div>
              <div className="text-sm mt-1">
                You have {stats.pendingInteractions} interaction{stats.pendingInteractions !== 1 ? 's' : ''} pending submission. 
                Remember to log all interactions within 48 hours per SOP requirements.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Voice Entry Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Log New Interaction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <Button
                onClick={() => setShowVoiceRecorder(true)}
                size="lg"
                className="w-24 h-24 rounded-full bg-accent hover:bg-accent/90 mb-4"
              >
                <Mic className="h-8 w-8" />
              </Button>
              <p className="text-gray-600 mb-4">
                Tap to start recording your interaction report
              </p>
              <div className="flex justify-center space-x-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Type Instead
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Interactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Recent Interactions</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentInteractions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No interactions yet</p>
                <p className="text-sm">Start by recording your first interaction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInteractions.slice(0, 5).map((interaction) => (
                  <div key={interaction.id} className="flex items-start space-x-3 p-3 border border-gray-100 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {interaction.prospectName}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {formatTimeAgo(interaction.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {interaction.summary}
                      </p>
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary" className="text-xs">
                          {interaction.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {interaction.method}
                        </Badge>
                        <div className={`flex items-center space-x-1 text-xs ${getStatusColor(interaction)}`}>
                          {getStatusIcon(interaction)}
                          <span>{getStatusText(interaction)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecordingComplete}
              onError={(error) => {
                setShowVoiceRecorder(false);
                toast({
                  title: "Recording Error",
                  description: error,
                  variant: "destructive",
                });
              }}
            />
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setShowVoiceRecorder(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      <ProcessingOverlay
        isVisible={showProcessing}
        onComplete={() => setShowProcessing(false)}
      />

      {/* Interaction Form */}
      <InteractionForm
        isVisible={showInteractionForm}
        extractedInfo={extractedInfo}
        transcript={currentTranscript}
        enhancedComments={enhancedComments}
        onSubmit={handleInteractionSubmit}
        onSaveDraft={handleSaveDraft}
        onClose={() => setShowInteractionForm(false)}
        isSubmitting={createInteraction.isPending || submitToBBEC.isPending}
      />
    </div>
  );
}
