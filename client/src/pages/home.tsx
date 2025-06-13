import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Mic, 
  Car, 
  Edit, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  TrendingUp,
  Send,
  Trash2,
  CheckSquare,
  Square,
  Tag,
  RefreshCw
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
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [voiceRecordingDraftId, setVoiceRecordingDraftId] = useState<number | null>(null);

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

  // State for bulk selection
  const [selectedInteractions, setSelectedInteractions] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Create voice recording mutation
  const createVoiceRecording = useMutation({
    mutationFn: async (data: { audioData: string; duration: number; transcript: string }) => {
      // First create a draft interaction
      const draftResponse = await apiRequest("POST", "/api/interactions/draft", {
        userId: 1,
        prospectName: 'Voice Recording',
        summary: 'Voice recording captured',
        category: 'General',
        subcategory: 'Other',
        contactLevel: 'In Person',
        method: 'Voice Recording',
        status: 'Draft',
        actualDate: new Date().toISOString().slice(0, 16),
        comments: 'Audio recorded, awaiting transcription',
        transcript: data.transcript,
        isDraft: true,
        bbecSubmitted: false
      });
      const draft = await draftResponse.json();
      
      // Then create voice recording linked to the draft
      const response = await apiRequest("POST", "/api/voice-recordings", {
        ...data,
        interactionId: draft.id
      });
      return response.json();
    },
    onSuccess: (recording) => {
      // Store the draft interaction ID for later use
      setVoiceRecordingDraftId(recording.interactionId);
      
      // Refresh data to show the new draft
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
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

  // Update interaction mutation
  const updateInteraction = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PATCH", `/api/interactions/${id}`, data);
      return response.json();
    },
    onSuccess: (interaction) => {
      if (!interaction.isDraft) {
        // Submit to BBEC if not a draft
        submitToBBEC.mutate(interaction.id);
      } else {
        // If it's a draft, just show success and refresh
        toast({
          title: "Draft Saved",
          description: "Interaction saved as draft successfully.",
        });
        setShowInteractionForm(false);
        setEditingInteraction(null);
        setExtractedInfo(null);
        setCurrentTranscript("");
        setEnhancedComments("");
        setVoiceRecordingDraftId(null);
        queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Update Error",
        description: "Failed to update interaction. Please try again.",
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
      setVoiceRecordingDraftId(null);
      
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
      return await apiRequest("POST", "/api/interactions/draft", data);
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
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      console.error("Draft save error:", error);
      toast({
        title: "Save Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete interaction mutation
  const deleteInteraction = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/interactions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Interaction deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Delete Error",
        description: "Failed to delete interaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteInteractions = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await apiRequest("DELETE", "/api/interactions", { ids });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Delete Complete",
        description: data.message,
      });
      setSelectedInteractions([]);
      setShowBulkActions(false);
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Bulk Delete Error",
        description: "Failed to delete selected interactions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVoiceRecordingComplete = (audioData: string, transcript: string, duration: number) => {
    setShowVoiceRecorder(false);
    
    // First save voice recording
    createVoiceRecording.mutate({
      audioData,
      transcript,
      duration
    });
  };

  const handleInteractionSubmit = (data: any) => {
    if (editingInteraction) {
      // Update existing interaction
      updateInteraction.mutate({ id: editingInteraction.id, data });
    } else if (voiceRecordingDraftId) {
      // Update the voice recording draft instead of creating new
      updateInteraction.mutate({ id: voiceRecordingDraftId, data });
    } else {
      // Create new interaction
      createInteraction.mutate(data);
    }
  };

  const handleSaveDraft = (data: any) => {
    if (editingInteraction) {
      // Update existing interaction as draft
      updateInteraction.mutate({ 
        id: editingInteraction.id, 
        data: { ...data, isDraft: true }
      });
    } else {
      // Create new draft
      saveDraft.mutate(data);
    }
  };

  // Selection handlers
  const handleSelectInteraction = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedInteractions([...selectedInteractions, id]);
    } else {
      setSelectedInteractions(selectedInteractions.filter(sid => sid !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInteractions(recentInteractions.map(i => i.id));
    } else {
      setSelectedInteractions([]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedInteractions.length > 0) {
      bulkDeleteInteractions.mutate(selectedInteractions);
    }
  };

  // Toggle bulk actions visibility when selections change
  useEffect(() => {
    setShowBulkActions(selectedInteractions.length > 0);
  }, [selectedInteractions]);



  const formatTimeAgo = (date: string | Date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleString();
  };

  const formatDateForInput = (date: string | Date) => {
    return new Date(date).toISOString().slice(0, 16);
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
      <header className="text-white px-4 py-3 shadow-sm" style={{ backgroundColor: '#CC0000' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6" />
            <div>
              <div className="font-medium text-sm">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.name || "Loading..."
                }
              </div>
              <div className="text-xs opacity-90">{user?.email || ""}</div>
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
                className="w-32 h-32 rounded-full mb-4"
                style={{ 
                  backgroundColor: '#CC0000',
                  borderColor: '#CC0000'
                }}
              >
                <div className="bg-white rounded-sm p-2 w-24 h-12">
                  <img 
                    src="https://www.bu.edu/brand/files/2019/06/master_logo.gif"
                    alt="Boston University Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </Button>
              <p className="text-gray-600 mb-4">
                Tap to start recording your interaction report
              </p>
              <div className="flex justify-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Clear all form state to ensure a blank form
                    setExtractedInfo(null);
                    setEditingInteraction(null);
                    setCurrentTranscript("");
                    setEnhancedComments("");
                    setShowInteractionForm(true);
                  }}
                >
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
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {recentInteractions.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedInteractions.length === recentInteractions.length}
                    onCheckedChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-primary">
                View All
              </Button>
            </div>
          </CardHeader>
          {showBulkActions && (
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-red-700">
                  {selectedInteractions.length} item(s) selected
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Selected Interactions</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedInteractions.length} interaction(s)? 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelected}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
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
                    <Checkbox
                      checked={selectedInteractions.includes(interaction.id)}
                      onCheckedChange={(checked) => handleSelectInteraction(interaction.id, !!checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {interaction.prospectName}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {formatTimeAgo(interaction.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">
                        {interaction.summary}
                      </p>
                      
                      {/* Affinity Tags */}
                      {interaction.affinityTags && interaction.affinityTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {interaction.affinityTags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {interaction.affinityTags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{interaction.affinityTags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
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
                        <div className="flex items-center space-x-2">
                          {interaction.isDraft && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingInteraction(interaction);
                                  setExtractedInfo(null);
                                  setCurrentTranscript("");
                                  setEnhancedComments("");
                                  setShowInteractionForm(true);
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Interaction</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{interaction.prospectName}"? 
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteInteraction.mutate(interaction.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          
                          {/* Submit to BBEC button for all interactions that haven't been submitted */}
                          {!interaction.bbecSubmitted && (
                            <Button
                              variant="default"
                              size="sm"
                              disabled={submitToBBEC.isPending}
                              onClick={() => {
                                submitToBBEC.mutate(interaction.id);
                              }}
                              className="h-7 px-2 text-xs"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {submitToBBEC.isPending ? "Submitting..." : "Submit to BBEC"}
                            </Button>
                          )}
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
        extractedInfo={extractedInfo || undefined}
        existingInteraction={editingInteraction}
        transcript={currentTranscript}
        enhancedComments={enhancedComments}
        onSubmit={handleInteractionSubmit}
        onSaveDraft={handleSaveDraft}
        onClose={() => {
          setShowInteractionForm(false);
          setEditingInteraction(null);
          setExtractedInfo(null);
          setCurrentTranscript("");
          setEnhancedComments("");
        }}
        isSubmitting={createInteraction.isPending || updateInteraction.isPending || submitToBBEC.isPending}
      />
    </div>
  );
}
