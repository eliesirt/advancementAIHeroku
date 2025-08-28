import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Save, 
  Play, 
  Code, 
  FileText, 
  Settings, 
  GitBranch,
  Tag,
  TestTube,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface PythonScript {
  id: number;
  name: string;
  description: string;
  tags: string[];
  ownerId: string;
  content: string;
  metadata: any;
  requirements: string[];
  version: number;
  isActive: boolean;
  lastRunAt: string | null;
  status: 'draft' | 'active' | 'deprecated';
  gitHash: string | null;
  gitBranch: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    firstName: string;
    lastName: string;
  };
}

export default function PythonScriptEditor() {
  const [match, params] = useRoute('/apps/python-ai/scripts/:id/edit');
  const scriptId = params?.id;
  const queryClient = useQueryClient();

  // State for form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    tags: [] as string[],
    requirements: [] as string[],
    status: 'draft' as 'draft' | 'active' | 'deprecated',
    gitBranch: 'main'
  });

  const [newTag, setNewTag] = useState('');
  const [newRequirement, setNewRequirement] = useState('');

  // Fetch script data
  const { data: script, isLoading } = useQuery({
    queryKey: ['/api/python-scripts', scriptId],
    queryFn: async () => {
      const response = await fetch(`/api/python-scripts/${scriptId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch script');
      }
      return response.json();
    },
    enabled: !!scriptId
  });

  // Update form data when script is loaded
  useEffect(() => {
    if (script) {
      setFormData({
        name: script.name || '',
        description: script.description || '',
        content: script.content || '',
        tags: script.tags || [],
        requirements: script.requirements || [],
        status: script.status || 'draft',
        gitBranch: script.gitBranch || 'main'
      });
    }
  }, [script]);

  // Save script mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/python-scripts/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to save script');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Script saved",
        description: "Your changes have been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/python-scripts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save script.",
        variant: "destructive"
      });
    }
  });

  // Execute script mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/python-scripts/${scriptId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: {} })
      });
      if (!response.ok) {
        throw new Error('Failed to execute script');
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Script executed",
        description: result.status === 'completed' ? "Script ran successfully" : `Status: ${result.status}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Execution failed",
        description: error.message || "Failed to execute script.",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleExecute = () => {
    // Save first, then execute
    saveMutation.mutate(formData, {
      onSuccess: () => {
        executeMutation.mutate();
      }
    });
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addRequirement = () => {
    if (newRequirement.trim() && !formData.requirements.includes(newRequirement.trim())) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }));
      setNewRequirement('');
    }
  };

  const removeRequirement = (reqToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter(req => req !== reqToRemove)
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading script...</span>
        </div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Script not found</h2>
              <p className="text-gray-600 mb-4">The script you're looking for doesn't exist.</p>
              <Link href="/apps/python-ai">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Scripts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/apps/python-ai">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Scripts
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Edit Script</h1>
              <p className="text-gray-600">Modify your Python script</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={handleExecute} 
              disabled={executeMutation.isPending || saveMutation.isPending}
              variant="outline"
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Run
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor" className="flex items-center">
                  <Code className="h-4 w-4 mr-2" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Script Content</CardTitle>
                    <CardDescription>
                      Write your Python code below
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="# Write your Python script here..."
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Script Details</CardTitle>
                    <CardDescription>
                      Configure script metadata and settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">Script Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter script name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what this script does"
                        className="min-h-[100px]"
                      />
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="deprecated">Deprecated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="gitBranch">Git Branch</Label>
                      <Input
                        id="gitBranch"
                        value={formData.gitBranch}
                        onChange={(e) => setFormData(prev => ({ ...prev, gitBranch: e.target.value }))}
                        placeholder="main"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="h-4 w-4 mr-2" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Add tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button size="sm" onClick={addTag}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-red-100"
                        onClick={() => removeTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TestTube className="h-4 w-4 mr-2" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Add requirement"
                      value={newRequirement}
                      onChange={(e) => setNewRequirement(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addRequirement()}
                    />
                    <Button size="sm" onClick={addRequirement}>Add</Button>
                  </div>
                  <div className="space-y-1">
                    {formData.requirements.map((req) => (
                      <Badge 
                        key={req} 
                        variant="outline" 
                        className="w-full justify-between cursor-pointer hover:bg-red-50"
                        onClick={() => removeRequirement(req)}
                      >
                        {req} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Script Info */}
            <Card>
              <CardHeader>
                <CardTitle>Script Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Version:</span>
                  <span>{script.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span>{format(new Date(script.createdAt), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span>{format(new Date(script.updatedAt), 'MMM dd, yyyy')}</span>
                </div>
                {script.lastRunAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Run:</span>
                    <span>{format(new Date(script.lastRunAt), 'MMM dd, yyyy')}</span>
                  </div>
                )}
                {script.owner && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Owner:</span>
                    <span>{script.owner.firstName} {script.owner.lastName}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}