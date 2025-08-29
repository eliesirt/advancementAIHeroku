import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings as SettingsIcon,
  User,
  Mic,
  Car,
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Volume2,
  Shield,
  Smartphone,
  Clock,
  Tags,
  Eye,
  Bot,
  Users // Added Users icon import
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserProfileUpdate } from "@/components/user-profile-update";
import { Textarea } from "@/components/ui/textarea";
import { AppNavigation } from "@/components/app-navigation";

interface VoiceSettings {
  enabled: boolean;
  autoStart: boolean;
  continuousMode: boolean;
  language: string;
  speechRate: number;
  speechVolume: number;
}

interface DrivingModeSettings {
  enabled: boolean;
  autoActivate: boolean;
  voiceConfirmation: boolean;
  handsFreeOnly: boolean;
}

interface BBECSettings {
  autoSubmit: boolean;
  validateSOP: boolean;
  requireAffinityTags: boolean;
  deadline48Hours: boolean;
}

// Define a more specific type for stats if possible, otherwise use any for now
type StatsType = {
  todayInteractions: number;
  thisWeekInteractions: number;
  pendingInteractions: number;
  lastWeekInteractions?: number; // Added for potential comparison
} | null | undefined;

// Define proper types for user and affinity tags info
type UserType = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  email?: string | null;
  bbecGuid?: string | null;
  buid?: string | null;
} | null | undefined;

type AffinityTagsInfoType = {
  total?: number;
  lastRefresh?: string;
  autoRefresh?: boolean;
  refreshInterval?: string;
  matchingThreshold?: number;
} | null | undefined;

type AffinityTagType = {
  id: number;
  name: string;
  category: string;
  bbecId?: string | null;
}

interface AffinityTagSettings {
  autoRefresh: boolean;
  refreshInterval: 'hourly' | 'daily' | 'weekly';
  lastRefresh?: string;
  totalTags?: number;
  matchingThreshold?: number;
}

interface AiPromptSettings {
  id: number;
  userId: number;
  promptType: string;
  promptTemplate: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}



export default function SettingsPage() {
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    autoStart: false,
    continuousMode: true,
    language: "en-US",
    speechRate: 1,
    speechVolume: 0.8
  });

  const [drivingSettings, setDrivingSettings] = useState<DrivingModeSettings>({
    enabled: true,
    autoActivate: false,
    voiceConfirmation: true,
    handsFreeOnly: true
  });

  const [bbecSettings, setBbecSettings] = useState<BBECSettings>({
    autoSubmit: false,
    validateSOP: true,
    requireAffinityTags: false,
    deadline48Hours: true
  });

  const [affinityTagSettings, setAffinityTagSettings] = useState<AffinityTagSettings>({
    autoRefresh: false,
    refreshInterval: 'daily',
    lastRefresh: undefined,
    totalTags: 0,
    matchingThreshold: 25
  });

  // Local state for slider value before saving
  const [tempThreshold, setTempThreshold] = useState<number>(25);
  const [hasUnsavedThreshold, setHasUnsavedThreshold] = useState<boolean>(false);

  // AI prompt settings state
  const [aiPromptSettings, setAiPromptSettings] = useState<{
    synopsis: string;
  }>({
    synopsis: ''
  });

  // AI model preference state
  const [aiModelPreference, setAiModelPreference] = useState<string>('gpt-4o');

  const { toast } = useToast();

  // Fetch user data
  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  // Fetch user with roles to check admin access
  const { data: userWithRoles } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Fetch BBEC connection status
  const { data: bbecStatus, isLoading: bbecLoading } = useQuery({
    queryKey: ["/api/bbec/form-metadata"],
    retry: false,
  });

  // Fetch affinity tags info
  const { data: affinityTagsInfo, refetch: refetchAffinityTags } = useQuery<AffinityTagsInfoType>({
    queryKey: ["/api/affinity-tags/info"],
    retry: false,
  });

  // Load settings when affinityTagsInfo is available
  useEffect(() => {
    if (affinityTagsInfo) {
      const threshold = affinityTagsInfo.matchingThreshold || 25;
      setAffinityTagSettings(prev => ({
        ...prev,
        autoRefresh: affinityTagsInfo.autoRefresh || false,
        refreshInterval: affinityTagsInfo.refreshInterval === undefined ? 'daily' : affinityTagsInfo.refreshInterval as 'hourly' | 'daily' | 'weekly',
        lastRefresh: affinityTagsInfo.lastRefresh,
        totalTags: affinityTagsInfo.total || 0,
        matchingThreshold: threshold
      }));
      // Only update tempThreshold if we don't have unsaved changes
      if (!hasUnsavedThreshold) {
        setTempThreshold(threshold);
      }
    }
  }, [affinityTagsInfo, hasUnsavedThreshold]);

  // Sync tempThreshold when affinityTagSettings.matchingThreshold changes (from successful save)
  useEffect(() => {
    if (!hasUnsavedThreshold && affinityTagSettings.matchingThreshold !== undefined) {
      setTempThreshold(affinityTagSettings.matchingThreshold);
    }
  }, [affinityTagSettings.matchingThreshold, hasUnsavedThreshold]);

  // Fetch affinity tags list
  const { data: affinityTags = [] } = useQuery<AffinityTagType[]>({
    queryKey: ["/api/affinity-tags"],
    retry: false,
  });

  // Fetch AI prompt settings
  const { data: aiPromptSettingsData } = useQuery<AiPromptSettings[]>({
    queryKey: ["/api/ai-prompt-settings", user?.id],
    enabled: !!user?.id,
    retry: false,
  });

  // Fetch AI model preference
  const { data: aiModelPreferenceData } = useQuery<{ value: string; description: string }>({
    queryKey: ["/api/settings/ai-model-preference"],
    retry: false,
  });

  // Load AI prompt settings when data is available
  useEffect(() => {
    if (aiPromptSettingsData) {
      const synopsisSetting = aiPromptSettingsData.find(s => s.promptType === 'synopsis');
      setAiPromptSettings({
        synopsis: synopsisSetting?.promptTemplate || ''
      });
    }
  }, [aiPromptSettingsData]);

  // Load AI model preference when data is available
  useEffect(() => {
    if (aiModelPreferenceData) {
      setAiModelPreference(aiModelPreferenceData.value);
    }
  }, [aiModelPreferenceData]);

  // Manual refresh affinity tags mutation
  const refreshAffinityTagsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/affinity-tags/refresh");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Refresh Complete",
        description: `Successfully refreshed ${data.synced} affinity tags from BBEC`,
      });
      setAffinityTagSettings(prev => ({
        ...prev,
        lastRefresh: new Date().toISOString(),
        totalTags: data.total
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/affinity-tags"] });
      refetchAffinityTags();
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh affinity tags from BBEC. Please check your connection.",
        variant: "destructive",
      });
    },
  });

  // Update auto-refresh settings mutation
  const updateAffinitySettingsMutation = useMutation({
    mutationFn: async (settings: AffinityTagSettings) => {
      const response = await apiRequest("POST", "/api/affinity-tags/settings", settings);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Updated",
        description: "Affinity tag refresh settings have been updated.",
      });
      // Invalidate and refetch the settings to ensure UI is in sync
      queryClient.invalidateQueries({ queryKey: ["/api/affinity-tags/info"] });
      refetchAffinityTags();
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to update affinity tag settings.",
        variant: "destructive",
      });
      // Revert the local state on error
      setTempThreshold(affinityTagSettings.matchingThreshold || 70);
      setHasUnsavedThreshold(false);
    },
  });

  // Update AI prompt settings mutation
  const updateAiPromptMutation = useMutation({
    mutationFn: async (data: { promptType: string; promptTemplate: string }) => {
      const response = await apiRequest("POST", "/api/ai-prompt-settings", {
        userId: user?.id,
        ...data
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AI Prompt Updated",
        description: "AI prompt template has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompt-settings", user?.id] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to save AI prompt template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update AI model preference mutation
  const updateAiModelPreferenceMutation = useMutation({
    mutationFn: async (value: string) => {
      const response = await apiRequest("POST", "/api/settings/ai-model-preference", { value });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI Model Preference Updated",
        description: `All OpenAI functionality will now use ${data.setting.value} as the primary model.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-model-preference"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to save AI model preference. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateVoiceSetting = (key: keyof VoiceSettings, value: any) => {
    setVoiceSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateDrivingSetting = (key: keyof DrivingModeSettings, value: any) => {
    setDrivingSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateBBECSetting = (key: keyof BBECSettings, value: any) => {
    setBbecSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateAffinityTagSetting = (key: keyof AffinityTagSettings, value: any) => {
    const newSettings = { ...affinityTagSettings, [key]: value };
    setAffinityTagSettings(newSettings);
    updateAffinitySettingsMutation.mutate(newSettings);
  };

  // Handle threshold slider changes (local state only)
  const handleThresholdChange = (value: number) => {
    setTempThreshold(value);
    setHasUnsavedThreshold(value !== affinityTagSettings.matchingThreshold);
  };

  // Save threshold to backend
  const saveThreshold = () => {
    const newSettings = { ...affinityTagSettings, matchingThreshold: tempThreshold };
    // Only update local state after successful mutation
    updateAffinitySettingsMutation.mutate(newSettings, {
      onSuccess: () => {
        setAffinityTagSettings(newSettings);
        setHasUnsavedThreshold(false);
      }
    });
  };

  // Reset threshold to saved value
  const resetThreshold = () => {
    setTempThreshold(affinityTagSettings.matchingThreshold || 25);
    setHasUnsavedThreshold(false);
  };

  const handleManualRefresh = () => {
    refreshAffinityTagsMutation.mutate();
  };

  const formatLastRefresh = (lastRefresh?: string) => {
    if (!lastRefresh) return "Never";
    const date = new Date(lastRefresh);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const testVoiceSynthesis = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        "Voice synthesis test. Your settings are working correctly."
      );
      utterance.rate = voiceSettings.speechRate;
      utterance.volume = voiceSettings.speechVolume;
      speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "Not Supported",
        description: "Speech synthesis is not supported in this browser.",
        variant: "destructive",
      });
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      toast({
        title: "Microphone Access",
        description: "Microphone permission granted successfully.",
      });
    } catch (error) {
      toast({
        title: "Microphone Error",
        description: "Unable to access microphone. Please check your browser permissions.",
        variant: "destructive",
      });
    }
  };

  // Save AI prompt setting
  const saveAiPromptSetting = (promptType: string, promptTemplate: string) => {
    updateAiPromptMutation.mutate({ promptType, promptTemplate });
  };

  // Update AI prompt settings local state
  const updateAiPromptSetting = (promptType: string, value: string) => {
    setAiPromptSettings(prev => ({ ...prev, [promptType]: value }));
  };

  // Handle AI model preference change
  const handleAiModelPreferenceChange = (value: string) => {
    setAiModelPreference(value);
    updateAiModelPreferenceMutation.mutate(value);
  };

  // Get default prompt template for reference
  const getDefaultPromptTemplate = () => {
    return `Analyze this fundraising interaction and create a concise synopsis for Boston University's Advancement office. 

Format your response as:
1. First, write 2-3 sentences that summarize the overall interaction and strategic significance
2. Then provide bullet points covering:
   • Key interests and motivations discovered
   • Perceived donor capacity signals
   • Next steps or follow-up actions
   • Strategic cultivation opportunities

Available variables:
- ${'{{transcript}}'} - Full interaction transcript
- ${'{{summary}}'} - AI-generated summary
- ${'{{category}}'} - Interaction category
- ${'{{professionalInterests}}'} - Professional interests found
- ${'{{personalInterests}}'} - Personal interests found
- ${'{{philanthropicPriorities}}'} - Philanthropic priorities found
- ${'{{keyPoints}}'} - Key points extracted

Keep the narrative portion brief and focused - maximum 3 sentences before the bullet points.`;
  };

  // Dummy state for UserProfileUpdate component if not directly handled
  const [userProfile, setUserProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    bbecGuid: user?.bbecGuid || '',
    buid: user?.buid || '',
  });

  // Update local state if user data changes from query
  useEffect(() => {
    setUserProfile({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      bbecGuid: user?.bbecGuid || '',
      buid: user?.buid || '',
    });
  }, [user]);

  // Handler for config changes
  const handleConfigChange = (key: string, value: any) => {
    // Assuming 'config' is intended to be affinityTagSettings for the purpose of this change
    // If 'config' is a separate state, it needs to be defined and managed.
    // For now, we'll update affinityTagSettings directly and trigger the mutation.
    const newSettings = { ...affinityTagSettings, [key]: value };
    setAffinityTagSettings(newSettings);
    updateAffinitySettingsMutation.mutate(newSettings);
  };

  return (
    <div className="min-h-screen bg-white">
      <AppNavigation appName="Settings" />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl" style={{ backgroundColor: '#CC0000' }}>
                <SettingsIcon className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Application Settings</h1>
            <p className="text-lg text-gray-600">
              Configure your AdvancementAI preferences and system settings to optimize your advancement workflow
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* User Profile */}
        <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <User className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>User Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={user?.firstName || ''}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={user?.lastName || ''}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="bbecGuid">BBEC GUID</Label>
                <Input
                  id="bbecGuid"
                  value={user?.bbecGuid || ''}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, bbecGuid: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="buid">BUID</Label>
                <Input
                  id="buid"
                  value={user?.buid || ''}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, buid: e.target.value }))}
                /></div>
            </div>
            <div className="flex justify-between items-center">
              <Alert className="flex-1 mr-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Profile information is synced with Blackbaud CRM.
                </AlertDescription>
              </Alert>
              <UserProfileUpdate user={user} />
            </div>
          </CardContent>
        </Card>

        {/* Voice Recording Settings */}
        <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <Mic className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>Voice Recording</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="voice-enabled">Enable Voice Recording</Label>
                <p className="text-sm text-gray-600">Allow voice input for interaction logging</p>
              </div>
              <Switch
                id="voice-enabled"
                checked={voiceSettings.enabled}
                onCheckedChange={(checked) => updateVoiceSetting('enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="continuous-mode">Continuous Recording</Label>
                <p className="text-sm text-gray-600">Keep recording until manually stopped</p>
              </div>
              <Switch
                id="continuous-mode"
                checked={voiceSettings.continuousMode}
                onCheckedChange={(checked) => updateVoiceSetting('continuousMode', checked)}
                disabled={!voiceSettings.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="speech-rate">Speech Synthesis Rate</Label>
              <input
                id="speech-rate"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSettings.speechRate}
                onChange={(e) => updateVoiceSetting('speechRate', parseFloat(e.target.value))}
                className="w-full"
                disabled={!voiceSettings.enabled}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Slow</span>
                <span>{voiceSettings.speechRate}x</span>
                <span>Fast</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="speech-volume">Speech Synthesis Volume</Label>
              <input
                id="speech-volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={voiceSettings.speechVolume}
                onChange={(e) => updateVoiceSetting('speechVolume', parseFloat(e.target.value))}
                className="w-full"
                disabled={!voiceSettings.enabled}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Quiet</span>
                <span>{Math.round(voiceSettings.speechVolume * 100)}%</span>
                <span>Loud</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkMicrophonePermission}
              >
                <Mic className="h-4 w-4 mr-2" />
                Test Microphone
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={testVoiceSynthesis}
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Test Speech
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Driving Mode Settings */}
        <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <Car className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>Driving Mode</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="driving-enabled">Enable Driving Mode</Label>
                <p className="text-sm text-gray-600">Hands-free operation for vehicle use</p>
              </div>
              <Switch
                id="driving-enabled"
                checked={drivingSettings.enabled}
                onCheckedChange={(checked) => updateDrivingSetting('enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="voice-confirmation">Voice Confirmation</Label>
                <p className="text-sm text-gray-600">Speak confirmations for actions</p>
              </div>
              <Switch
                id="voice-confirmation"
                checked={drivingSettings.voiceConfirmation}
                onCheckedChange={(checked) => updateDrivingSetting('voiceConfirmation', checked)}
                disabled={!drivingSettings.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hands-free-only">Hands-Free Only</Label>
                <p className="text-sm text-gray-600">Disable all touch controls in driving mode</p>
              </div>
              <Switch
                id="hands-free-only"
                checked={drivingSettings.handsFreeOnly}
                onCheckedChange={(checked) => updateDrivingSetting('handsFreeOnly', checked)}
                disabled={!drivingSettings.enabled}
              />
            </div>

            <Alert className="border-yellow-200 bg-yellow-50">
              <Car className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Safety Notice:</strong> Always prioritize road safety. Use voice commands only when safe to do so.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* BBEC Integration Settings */}
        <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <Database className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>Blackbaud CRM Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${bbecStatus ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-medium">
                  {bbecLoading ? 'Checking...' : bbecStatus ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <Badge variant={bbecStatus ? 'default' : 'destructive'}>
                {bbecStatus ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-submit">Auto-submit to BBEC</Label>
                <p className="text-sm text-gray-600">Automatically submit completed interactions</p>
              </div>
              <Switch
                id="auto-submit"
                checked={bbecSettings.autoSubmit}
                onCheckedChange={(checked) => updateBBECSetting('autoSubmit', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="validate-sop">SOP Validation</Label>
                <p className="text-sm text-gray-600">Enforce SOP compliance rules</p>
              </div>
              <Switch
                id="validate-sop"
                checked={bbecSettings.validateSOP}
                onCheckedChange={(checked) => updateBBECSetting('validateSOP', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="deadline-48hours">48-Hour Deadline Alerts</Label>
                <p className="text-sm text-gray-600">Alert when approaching SOP deadline</p>
              </div>
              <Switch
                id="deadline-48hours"
                checked={bbecSettings.deadline48Hours}
                onCheckedChange={(checked) => updateBBECSetting('deadline48Hours', checked)}
              />
            </div>

            {/* Affinity Tags Section */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center space-x-2">
                    <Tags className="h-4 w-4" />
                    <span>Affinity Tags Management</span>
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">Manage AI analysis tags from BBEC</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Tags
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <Tags className="h-5 w-5" />
                          <span>Stored Affinity Tags ({affinityTags.length})</span>
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-96 w-full pr-4">
                        <div className="space-y-2">
                          {affinityTags.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Tags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="font-medium">No affinity tags found</p>
                              <p className="text-sm">Click "Refresh Now" to load tags from BBEC</p>
                            </div>
                          ) : (
                            [...affinityTags]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((tag, index) => (
                                <div key={tag.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{tag.name}</div>
                                    <div className="text-sm text-gray-600">{tag.category}</div>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    #{index + 1}
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={refreshAffinityTagsMutation.isPending}
                  >
                    {refreshAffinityTagsMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Now
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Affinity Tags Status */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Tags:</span>
                  <Badge variant="secondary">{affinityTagsInfo?.total || affinityTagSettings.totalTags || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Refresh:</span>
                  <span className="text-gray-900">
                    {formatLastRefresh(affinityTagsInfo?.lastRefresh || affinityTagSettings.lastRefresh)}
                  </span>
                </div>
              </div>

              {/* Matching Threshold Slider */}
              <div className="space-y-3">
                <Label htmlFor="matching-threshold">Affinity Tag Matching Confidence</Label>
                <p className="text-sm text-gray-600">Adjust how tightly or loosely affinity tags are matched to interaction text</p>
                <input
                  id="matching-threshold"
                  type="range"
                  min="5"
                  max="95"
                  step="5"
                  value={tempThreshold}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Loose (5%)</span>
                  <span className={hasUnsavedThreshold ? "font-semibold text-orange-600" : ""}>{tempThreshold}% confidence</span>
                  <span>Strict (95%)</span>
                </div>

                {hasUnsavedThreshold && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-700">You have unsaved changes</span>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetThreshold}
                        className="text-xs"
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveThreshold}
                        disabled={updateAffinitySettingsMutation.isPending}
                        className="text-xs"
                      >
                        {updateAffinitySettingsMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                  <strong>Tip:</strong> Lower values match more tags but may include less relevant ones. Higher values are more precise but may miss some matches.
                </div>
              </div>

              {/* Auto-refresh Settings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-refresh">Automatic Refresh</Label>
                    <p className="text-sm text-gray-600">Enable scheduled affinity tag updates</p>
                  </div>
                  <Switch
                    id="auto-refresh"
                    checked={affinityTagSettings.autoRefresh}
                    onCheckedChange={(checked) => updateAffinityTagSetting('autoRefresh', checked)}
                  />
                </div>

                {affinityTagSettings.autoRefresh && (
                  <div className="pl-4 border-l-2 border-gray-200">
                    <Label htmlFor="refresh-interval" className="text-sm font-medium">
                      Refresh Interval
                    </Label>
                    <Select
                      value={affinityTagSettings.refreshInterval}
                      onValueChange={(value: 'hourly' | 'daily' | 'weekly') =>
                        updateAffinityTagSetting('refreshInterval', value)
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>Every Hour</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="daily">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>Daily</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="weekly">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>Weekly</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Next refresh: {affinityTagSettings.autoRefresh ? 'Scheduled' : 'Not scheduled'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Model Preference Section */}
        <Card className="border-2 hover:border-green-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-green-50">
                <Bot className="h-6 w-6" style={{ color: '#22c55e' }} />
              </div>
              <span>AI Model Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label htmlFor="aiModelPreference" className="text-base font-medium">
                AI Model Preference
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose the primary AI model for all OpenAI functionality across the platform (script generation, analysis, prompts).
              </p>
              <Select
                value={aiModelPreference}
                onValueChange={handleAiModelPreferenceChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select AI model preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-5">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">GPT-5</div>
                        <div className="text-xs text-muted-foreground">Latest model (recommended)</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">GPT-4o</div>
                        <div className="text-xs text-muted-foreground">Fast, optimized model (default)</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">GPT-4</div>
                        <div className="text-xs text-muted-foreground">Reliable, older model</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-3 p-3 bg-blue-50 rounded-md">
                <div className="text-sm">
                  <strong>Current setting:</strong> {aiModelPreference} 
                  {updateAiModelPreferenceMutation.isPending && (
                    <span className="ml-2 text-blue-600">Saving...</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  This affects PythonAI script generation, InteractionAI analysis, and all other OpenAI features across the platform.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Prompt Customization */}
        <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <Bot className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>AI Prompt Customization</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label htmlFor="synopsis-prompt" className="text-sm font-medium">
                  Advancement Office Synopsis Prompt
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateAiPromptSetting('synopsis', getDefaultPromptTemplate())}
                >
                  Reset to Default
                </Button>
              </div>
              <Textarea
                id="synopsis-prompt"
                placeholder="Enter your custom prompt template..."
                value={aiPromptSettings.synopsis || getDefaultPromptTemplate()}
                onChange={(e) => updateAiPromptSetting('synopsis', e.target.value)}
                rows={12}
                className="text-sm font-mono"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-500">
                  Use variables like {`{{transcript}}`}, {`{{summary}}`}, {`{{category}}`} in your template
                </p>
                <Button
                  onClick={() => saveAiPromptSetting('synopsis', aiPromptSettings.synopsis)}
                  disabled={updateAiPromptMutation.isPending}
                >
                  {updateAiPromptMutation.isPending ? 'Saving...' : 'Save Prompt'}
                </Button>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <div className="font-medium mb-2">Available Template Variables</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <strong>{`{{transcript}}`}</strong> - Full interaction transcript
                  </div>
                  <div>
                    <strong>{`{{summary}}`}</strong> - AI-generated summary
                  </div>
                  <div>
                    <strong>{`{{category}}`}</strong> - Interaction category
                  </div>
                  <div>
                    <strong>{`{{professionalInterests}}`}</strong> - Professional interests
                  </div>
                  <div>
                    <strong>{`{{personalInterests}}`}</strong> - Personal interests
                  </div>
                  <div>
                    <strong>{`{{philanthropicPriorities}}`}</strong> - Philanthropic priorities
                  </div>
                  <div>
                    <strong>{`{{keyPoints}}`}</strong> - Key points extracted
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* User & Role Management - Only for Administrators */}
        {(userWithRoles as any)?.roles?.some((role: any) => role.name === "Administrator") && (
          <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
                <div className="p-2 rounded-lg bg-red-50">
                  <Users className="h-6 w-6" style={{ color: '#CC0000' }} />
                </div>
                <span>User & Role Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Administrator Access</Label>
                <p className="text-sm text-gray-600 mb-4">
                  Manage user accounts, roles, and permissions for the AdvancementAI application suite.
                </p>
                <Button 
                  onClick={() => window.location.href = '/apps/user-management'}
                  className="w-full"
                  style={{ backgroundColor: '#CC0000' }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Open User Management Console
                </Button>
              </div>
              
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Administrative Functions</div>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Create and manage user accounts</li>
                    <li>Assign and remove user roles</li>
                    <li>Configure application permissions</li>
                    <li>Manage role-based access control</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Privacy & Compliance */}
<Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <Shield className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>Privacy & Compliance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Data Privacy Reminder</div>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Voice recordings are processed securely and not stored permanently</li>
                  <li>All interaction data follows university privacy policies</li>
                  <li>Sensitive information should not be included in comments</li>
                  <li>FERPA and confidentiality guidelines must be followed</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">SOP Requirements</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• 48-hour entry deadline</li>
                  <li>• Required form fields</li>
                  <li>• Prospect plan linkage</li>
                  <li>• Privacy compliance</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">AI Processing</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Interest extraction</li>
                  <li>• Affinity tag matching</li>
                  <li>• Comment enhancement</li>
                  <li>• Category suggestions</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Information */}
        <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg bg-red-50">
                <Smartphone className="h-6 w-6" style={{ color: '#CC0000' }} />
              </div>
              <span>App Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>Version</Label>
                <p className="text-gray-600">1.0.0</p>
              </div>
              <div>
                <Label>Last Updated</Label>
                <p className="text-gray-600">January 2024</p>
              </div>
              <div>
                <Label>Platform</Label>
                <p className="text-gray-600">Progressive Web App</p>
              </div>
              <div>
                <Label>Support</Label>
                <p className="text-gray-600">IT Help Desk</p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                For technical support or to report issues, contact your IT Help Desk or the Advancement Services team.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}