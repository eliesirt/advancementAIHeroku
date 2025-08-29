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
  RefreshCw,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Components
import { VoiceRecorder } from "@/components/voice-recorder";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { InteractionForm } from "@/components/interaction-form";
import { TypeInteractionForm } from "@/components/type-interaction-form";

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

// Define a more specific type for user if possible, otherwise use any for now
type UserType = {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
} | null | undefined;

// Define a more specific type for stats if possible, otherwise use any for now
type StatsType = {
  todayInteractions: number;
  thisWeekInteractions: number;
  pendingInteractions: number;
  lastWeekInteractions?: number; // Added for potential comparison
} | null | undefined;


export default function HomePage({ onDrivingModeToggle, isDrivingMode }: HomePageProps) {
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [enhancedComments, setEnhancedComments] = useState("");
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [expandedQualityTips, setExpandedQualityTips] = useState<Set<number>>(new Set());
  const [currentQualityData, setCurrentQualityData] = useState<{
    qualityScore: number;
    qualityExplanation: string;
    qualityRecommendations: string[];
  } | null>(null);
  const [submittingInteractionId, setSubmittingInteractionId] = useState<number | null>(null);
  const [showProcessing, setShowProcessing] = useState(false);
  const [currentAiModel, setCurrentAiModel] = useState("GPT-5");

  const { toast } = useToast();

  // Fetch user data
  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery<StatsType>({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent interactions
  const { data: recentInteractions = [] } = useQuery<Interaction[]>({
    queryKey: ["/api/interactions/recent"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch AI model preference for processing display
  const { data: aiModelPreference } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/ai-model-preference"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Update current AI model when preference changes
  useEffect(() => {
    if (aiModelPreference?.value) {
      const modelDisplay = aiModelPreference.value === 'gpt-5' ? 'GPT-5' :
                           aiModelPreference.value === 'gpt-4o' ? 'GPT-4o' : 
                           aiModelPreference.value === 'gpt-4' ? 'GPT-4' : 'GPT-5';
      setCurrentAiModel(modelDisplay);
    }
  }, [aiModelPreference]);

  // State for bulk selection
  const [selectedInteractions, setSelectedInteractions] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Create voice recording mutation
  const createVoiceRecording = useMutation({
    mutationFn: async (data: { audioData: string; duration: number; transcript: string }) => {
      // Process the voice recording directly without creating a draft interaction
      const processResponse = await apiRequest("POST", "/api/voice-recordings/process-direct", {
        transcript: data.transcript,
        audioData: data.audioData,
        duration: data.duration
      });
      const processedData = await processResponse.json();

      return processedData;
    },
    onSuccess: (data) => {
      console.log("Voice recording API response:", data);
      console.log("Full response structure:", JSON.stringify(data, null, 2));
      
      // Comprehensive fallback handling for different response formats
      let transcript = '';
      let extractedInfo = null;
      let enhancedComments = '';

      // Try multiple possible response structures
      if (data.transcript) {
        // New format - direct properties
        transcript = data.transcript;
        extractedInfo = data.extractedInfo;
        enhancedComments = data.enhancedComments || data.extractedInfo?.summary || '';
      } else if (data.voiceRecording) {
        // Old format - nested in voiceRecording
        transcript = data.voiceRecording.transcript || '';
        extractedInfo = data.voiceRecording.extractedInfo;
        enhancedComments = data.voiceRecording.aiSynopsis || data.voiceRecording.enhancedComments || '';
      } else if (data.result) {
        // Alternative format - nested in result
        transcript = data.result.transcript || '';
        extractedInfo = data.result.extractedInfo;
        enhancedComments = data.result.enhancedComments || data.result.aiSynopsis || '';
      } else {
        // Fallback - use raw transcript if available
        transcript = data.message || data.text || data.content || '';
        console.warn("Unknown response format, using fallback transcript");
      }

      console.log("Parsed voice data:", { 
        transcript: transcript?.substring(0, 100) + "...",
        transcriptLength: transcript?.length,
        hasExtractedInfo: !!extractedInfo,
        extractedInfoKeys: extractedInfo ? Object.keys(extractedInfo) : [],
        enhancedCommentsLength: enhancedComments?.length || 0,
        enhancedCommentsSample: enhancedComments?.substring(0, 50) + "..."
      });

      // If we don't have AI analysis but have a transcript, show warning
      if (transcript && transcript.length > 50 && (!extractedInfo || !enhancedComments)) {
        console.warn("Voice processing may not have completed AI analysis. Only transcript available.");
        toast({
          title: "Partial Processing Complete",
          description: "Transcript ready. Click 'Analyze with AI' to extract key information.",
          variant: "default"
        });
      }
      
      // Set the processed data 
      setCurrentTranscript(transcript);
      setExtractedInfo(extractedInfo);
      setEnhancedComments(enhancedComments);
      
      // Set quality assessment data if available from voice processing
      if (data.qualityAssessment) {
        setCurrentQualityData({
          qualityScore: data.qualityAssessment.qualityScore,
          qualityExplanation: data.qualityAssessment.qualityExplanation,
          qualityRecommendations: data.qualityAssessment.recommendations
        });
      }
      
      setEditingInteraction(null);
      
      // Small delay to ensure state is set, then show form and hide processing
      setTimeout(() => {
        setShowInteractionForm(true);
        setShowProcessing(false);
      }, 100);

      // Success message based on what we got
      const hasAiAnalysis = !!(extractedInfo && enhancedComments);
      toast({
        title: hasAiAnalysis ? "Voice Recording Processed" : "Transcript Ready",
        description: hasAiAnalysis 
          ? "Your voice recording has been transcribed and analyzed. Please review and submit."
          : "Voice transcribed. Use 'Analyze with AI' for detailed analysis.",
      });
    },
    onError: (error) => {
      // Hide processing overlay on error
      setShowProcessing(false);
      
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
      setSubmittingInteractionId(interactionId);
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
      setSubmittingInteractionId(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      setSubmittingInteractionId(null);
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
      console.log(`🗑️ Frontend: Deleting interaction ${id}`);
      const response = await apiRequest("DELETE", `/api/interactions/${id}`);
      const result = await response.json();
      console.log(`✅ Frontend: Delete response for ${id}:`, result);
      return result;
    },
    onSuccess: (data, id) => {
      console.log(`✅ Frontend: Delete success for ${id}`, data);
      toast({
        title: "Deleted",
        description: "Interaction deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error, id) => {
      console.error(`❌ Frontend: Delete error for ${id}:`, error);
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
    setShowProcessing(true); // Show processing overlay while AI analysis runs

    // Process voice recording with AI analysis
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

  // Handle completion from TypeInteractionForm (same as voice recording completion)
  const handleTypeComplete = (transcript: string, extractedInfo: ExtractedInfo, enhancedComments: string) => {
    // Set the state to show the full interaction form with processed data
    setCurrentTranscript(transcript);
    setExtractedInfo(extractedInfo);
    setEnhancedComments(enhancedComments);
    setEditingInteraction(null); // Ensure this is a new interaction, not editing existing
    setShowInteractionForm(true);
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
    <div>
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
        {stats?.pendingInteractions !== undefined && stats.pendingInteractions > 0 && (
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
                    src="/bu-logo.svg" 
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
                    // Open the simplified type form instead of the full form
                    setShowTypeForm(true);
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

                      {/* Quality Assessment */}
                      {interaction.qualityScore !== null && interaction.qualityScore !== undefined && (
                        <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="text-xs font-medium text-blue-900">Quality</div>
                              <Badge 
                                variant="outline"
                                className={`text-xs ${
                                  interaction.qualityScore >= 21 ? 'bg-green-100 text-green-800 border-green-300' :
                                  interaction.qualityScore >= 16 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  interaction.qualityScore >= 11 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                  'bg-red-100 text-red-800 border-red-300'
                                }`}
                              >
                                {interaction.qualityScore}/25
                              </Badge>
                            </div>
                            <div className="text-xs text-blue-700">
                              {interaction.qualityScore >= 21 ? 'Excellent' :
                               interaction.qualityScore >= 16 ? 'Proficient' :
                               interaction.qualityScore >= 11 ? 'Developing' :
                               'Needs Improvement'}
                            </div>
                          </div>
                          {interaction.qualityRecommendations && interaction.qualityRecommendations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-blue-200">
                              <div className="text-xs font-medium text-blue-900 mb-1">Improvement Tips:</div>
                              <ul className="text-xs text-blue-800 space-y-1">
                                {(expandedQualityTips.has(interaction.id) 
                                  ? interaction.qualityRecommendations 
                                  : interaction.qualityRecommendations.slice(0, 2)
                                ).map((rec: string, idx: number) => (
                                  <li key={idx} className="flex items-start">
                                    <span className="text-blue-600 mr-1">•</span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                                {interaction.qualityRecommendations.length > 2 && (
                                  <li className="text-blue-600 text-xs">
                                    <button 
                                      onClick={() => {
                                        const newExpanded = new Set(expandedQualityTips);
                                        if (newExpanded.has(interaction.id)) {
                                          newExpanded.delete(interaction.id);
                                        } else {
                                          newExpanded.add(interaction.id);
                                        }
                                        setExpandedQualityTips(newExpanded);
                                      }}
                                      className="hover:text-blue-800 underline cursor-pointer"
                                    >
                                      {expandedQualityTips.has(interaction.id) 
                                        ? "Show less" 
                                        : `+${interaction.qualityRecommendations.length - 2} more suggestions`
                                      }
                                    </button>
                                  </li>
                                )}
                              </ul>
                            </div>
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
                              disabled={submittingInteractionId === interaction.id}
                              onClick={() => {
                                submitToBBEC.mutate(interaction.id);
                              }}
                              className="h-7 px-2 text-xs"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {submittingInteractionId === interaction.id ? "Submitting..." : "Submit to BBEC"}
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
        aiModel={currentAiModel}
      />

      {/* Interaction Form */}
      <InteractionForm
        isVisible={showInteractionForm}
        extractedInfo={extractedInfo || undefined}
        existingInteraction={editingInteraction}
        transcript={currentTranscript}
        enhancedComments={enhancedComments}
        currentQualityData={currentQualityData}
        onSubmit={handleInteractionSubmit}
        onSaveDraft={handleSaveDraft}
        onClose={() => {
          setShowInteractionForm(false);
          setEditingInteraction(null);
          setExtractedInfo(null);
          setCurrentTranscript("");
          setEnhancedComments("");
          setCurrentQualityData(null);
        }}
        isSubmitting={createInteraction.isPending || updateInteraction.isPending || submitToBBEC.isPending}
      />

      {/* Type Interaction Form */}
      <TypeInteractionForm
        isVisible={showTypeForm}
        onComplete={handleTypeComplete}
        onClose={() => setShowTypeForm(false)}
      />
    </div>
  );
}