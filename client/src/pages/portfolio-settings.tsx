import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Settings, Sparkles, Target } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { useToast } from "@/hooks/use-toast";

interface AiPromptSettings {
  generateAiPrompt: string;
  nextActionsPrompt: string;
}

export default function PortfolioSettingsPage() {
  const [settings, setSettings] = useState<AiPromptSettings>({
    generateAiPrompt: '',
    nextActionsPrompt: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default prompts
  const defaultPrompts = {
    generateAiPrompt: `You are an expert fundraising analyst. Analyze this prospect's profile and generate a comprehensive AI summary including:

1. **Prospect Overview**: Key demographic and professional information
2. **Giving Capacity**: Analysis of their potential giving level based on available data
3. **Engagement History**: Summary of past interactions and giving patterns
4. **Strategic Insights**: Key opportunities and considerations for cultivation
5. **Relationship Mapping**: Important connections and affiliations

Focus on actionable insights that will help the fundraiser build meaningful relationships and identify cultivation opportunities.`,

    nextActionsPrompt: `You are a strategic fundraising advisor. Based on this prospect's profile and interaction history, recommend 3-5 specific next actions for the fundraiser:

1. **Immediate Actions** (next 1-2 weeks)
2. **Short-term Strategy** (next 1-3 months)  
3. **Long-term Cultivation** (3-12 months)

Each recommendation should be:
- Specific and actionable
- Tailored to the prospect's interests and giving capacity
- Focused on relationship building and stewardship
- Include suggested timeline and follow-up steps

Consider their preferred communication methods, past giving history, and current engagement level.`
  };

  // Fetch current settings
  const { data: currentSettings, isLoading } = useQuery<AiPromptSettings>({
    queryKey: ['/api/portfolio/settings'],
    retry: false,
  });

  // Initialize settings when data loads
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    } else {
      // Use default prompts if no settings exist
      setSettings(defaultPrompts);
    }
  }, [currentSettings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AiPromptSettings) => {
      return await apiRequest('POST', '/api/portfolio/settings', newSettings);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your AI prompt settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/settings'] });
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(settings);
  };

  const resetToDefaults = () => {
    setSettings(defaultPrompts);
    toast({
      title: "Reset to Defaults",
      description: "Prompt settings have been reset to default values.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="portfolioAI" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Settings className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-2" />
            <span className="text-gray-600">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation appName="portfolioAI" />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-8 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-white/20">
                    <Settings className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">portfolioAI Settings</h1>
                    <p className="text-red-100 text-lg mt-1">
                      Customize AI prompts for prospect analysis and recommendations
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.location.href = '/apps/portfolio'}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50"
                  data-testid="button-back-to-portfolio"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portfolio
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="space-y-6">
          {/* Generate AI Prompt Settings */}
          <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
                <div className="p-2 rounded-lg bg-red-50">
                  <Sparkles className="h-6 w-6" style={{ color: '#CC0000' }} />
                </div>
                <span>Generate AI Summary Prompt</span>
              </CardTitle>
              <p className="text-gray-600">
                This prompt is used when you click "Generate AI" to analyze a prospect's profile and create insights.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Label htmlFor="generateAiPrompt">AI Analysis Prompt</Label>
                <Textarea
                  id="generateAiPrompt"
                  value={settings.generateAiPrompt}
                  onChange={(e) => setSettings(prev => ({ ...prev, generateAiPrompt: e.target.value }))}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Enter your custom prompt for AI prospect analysis..."
                  data-testid="textarea-generate-ai-prompt"
                />
                <p className="text-sm text-gray-500">
                  This prompt will be used to analyze prospect profiles and generate comprehensive insights.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Next Actions Prompt Settings */}
          <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
                <div className="p-2 rounded-lg bg-red-50">
                  <Target className="h-6 w-6" style={{ color: '#CC0000' }} />
                </div>
                <span>Generate Next Actions Prompt</span>
              </CardTitle>
              <p className="text-gray-600">
                This prompt is used when you click "Generate Next Actions" to create strategic recommendations.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Label htmlFor="nextActionsPrompt">Next Actions Prompt</Label>
                <Textarea
                  id="nextActionsPrompt"
                  value={settings.nextActionsPrompt}
                  onChange={(e) => setSettings(prev => ({ ...prev, nextActionsPrompt: e.target.value }))}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Enter your custom prompt for generating next actions..."
                  data-testid="textarea-next-actions-prompt"
                />
                <p className="text-sm text-gray-500">
                  This prompt will be used to generate strategic next action recommendations for prospects.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              data-testid="button-reset-defaults"
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveSettingsMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}