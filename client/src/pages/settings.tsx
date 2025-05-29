import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Smartphone
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  // Sync affinity tags mutation
  const syncAffinityTags = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/affinity-tags/sync");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data.synced} affinity tags from BBEC`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/affinity-tags"] });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Unable to sync affinity tags from BBEC. Please check your connection.",
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
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={user?.name || ""} disabled />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={user?.role || ""} disabled />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={user?.username || ""} disabled />
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                User profile information is managed by your organization's IT department.
              </AlertDescription>
            </Alert>
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

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label>Affinity Tags</Label>
                  <p className="text-sm text-gray-600">Sync latest affinity tags from BBEC</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncAffinityTags.mutate()}
                  disabled={syncAffinityTags.isPending}
                >
                  {syncAffinityTags.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
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
