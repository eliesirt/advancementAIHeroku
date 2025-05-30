import { useState, useEffect } from "react";
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
  Eye
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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

interface AffinityTagSettings {
  autoRefresh: boolean;
  refreshInterval: 'hourly' | 'daily' | 'weekly';
  lastRefresh?: string;
  totalTags?: number;
}

const userProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  buid: z.string().min(1, "BUID is required"),
});

type UserProfileFormData = z.infer<typeof userProfileSchema>;

interface UserProfileUpdateDialogProps {
  user: any;
}

function UserProfileUpdateDialog({ user }: UserProfileUpdateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      buid: user?.buid || "",
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: UserProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const searchUserByBuid = async (buid: string) => {
    if (!buid) return;
    
    setIsSearching(true);
    try {
      const response = await apiRequest("GET", `/api/users/search/${buid}`);
      const userData = await response.json();
      
      if (response.ok) {
        setSearchResult(userData);
        // Auto-fill form with BBEC data
        form.setValue("firstName", userData.first_name || "");
        form.setValue("lastName", userData.last_name || "");
        form.setValue("email", userData.email || "");
        
        toast({
          title: "User Found",
          description: "Profile information loaded from Blackbaud CRM.",
        });
      } else {
        setSearchResult(null);
        toast({
          title: "User Not Found",
          description: "No user found with this BUID in Blackbaud CRM.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setSearchResult(null);
      toast({
        title: "Search Failed",
        description: "Unable to search user in Blackbaud CRM.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (data: UserProfileFormData) => {
    updateUserMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <User className="h-4 w-4 mr-2" />
          Update User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update User Profile</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="buid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BUID</FormLabel>
                  <div className="flex space-x-2">
                    <FormControl>
                      <Input {...field} placeholder="Enter BUID" />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => searchUserByBuid(field.value)}
                      disabled={isSearching || !field.value}
                    >
                      {isSearching ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {searchResult && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Found: {searchResult.name} ({searchResult.email})
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Updating..." : "Update Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
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
    totalTags: 0
  });

  const { toast } = useToast();

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Fetch BBEC connection status
  const { data: bbecStatus, isLoading: bbecLoading } = useQuery({
    queryKey: ["/api/bbec/form-metadata"],
    retry: false,
  });

  // Fetch affinity tags info
  const { data: affinityTagsInfo, refetch: refetchAffinityTags } = useQuery({
    queryKey: ["/api/affinity-tags/info"],
    retry: false,
  });

  // Load settings when affinityTagsInfo is available
  useEffect(() => {
    if (affinityTagsInfo) {
      setAffinityTagSettings(prev => ({
        ...prev,
        autoRefresh: affinityTagsInfo.autoRefresh || false,
        refreshInterval: affinityTagsInfo.refreshInterval || 'daily',
        lastRefresh: affinityTagsInfo.lastRefresh,
        totalTags: affinityTagsInfo.total || 0
      }));
    }
  }, [affinityTagsInfo]);

  // Fetch affinity tags list
  const { data: affinityTags = [] } = useQuery({
    queryKey: ["/api/affinity-tags"],
    retry: false,
  });

  // Manual refresh affinity tags mutation
  const refreshAffinityTags = useMutation({
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
  const updateAffinitySettings = useMutation({
    mutationFn: async (settings: AffinityTagSettings) => {
      const response = await apiRequest("POST", "/api/affinity-tags/settings", settings);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Affinity tag refresh settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to update affinity tag settings.",
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
    
    // Auto-save settings when changed
    updateAffinitySettings.mutate(newSettings);
  };

  const handleManualRefresh = () => {
    refreshAffinityTags.mutate();
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="h-6 w-6 text-gray-600" />
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>User Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={user?.firstName || ""} disabled />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={user?.lastName || ""} disabled />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
              <div>
                <Label htmlFor="buid">BUID</Label>
                <Input id="buid" value={user?.buid || ""} disabled />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <Alert className="flex-1 mr-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Profile information is synced with Blackbaud CRM.
                </AlertDescription>
              </Alert>
              <UserProfileUpdateDialog user={user} />
            </div>
          </CardContent>
        </Card>

        {/* Voice Recording Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mic className="h-5 w-5" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Car className="h-5 w-5" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
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
                    disabled={refreshAffinityTags.isPending}
                  >
                    {refreshAffinityTags.isPending ? (
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

        {/* Privacy & Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5" />
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
