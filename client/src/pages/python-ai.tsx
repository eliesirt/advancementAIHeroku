import { useState, useEffect, startTransition } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { 
  Code, 
  Play, 
  Upload, 
  Calendar, 
  Clock, 
  Settings, 
  Search, 
  Filter, 
  Download,
  GitBranch,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Tag,
  MoreHorizontal,
  Edit,
  Trash2,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  GitCommit,
  TestTube,
  Shield,
  Zap,
  ArrowLeft,
  FilePlus
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

interface ScriptExecution {
  id: number;
  scriptId: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  inputs: any;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  duration: number | null;
  startedAt: string | null;
  completedAt: string | null;
  isScheduled: boolean;
  createdAt: string;
  triggeredByUser?: {
    firstName: string;
    lastName: string;
  };
  script?: {
    name: string;
    description: string;
  };
}

export default function PythonAI() {
  const [activeTab, setActiveTab] = useState('scripts');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [selectedScript, setSelectedScript] = useState<PythonScript | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  const queryClient = useQueryClient();

  // Initialize component with startTransition to prevent suspension
  useEffect(() => {
    startTransition(() => {
      setIsReady(true);
    });
  }, []);

  // Fetch Python scripts - only when ready
  const { data: scripts = [], isLoading: scriptsLoading } = useQuery({
    queryKey: ['/api/python-scripts'],
    enabled: isReady,
    suspense: false,
  });

  // Fetch script executions - only when ready
  const { data: executions = [], isLoading: executionsLoading } = useQuery({
    queryKey: ['/api/script-executions'],
    enabled: isReady,
    suspense: false,
  });

  // Create script mutation
  const createScriptMutation = useMutation({
    mutationFn: async (scriptData: any) => {
      const response = await fetch('/api/python-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scriptData),
      });
      if (!response.ok) throw new Error('Failed to create script');
      return response.json();
    },
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/python-scripts'] });
        setIsCreateDialogOpen(false);
      });
      toast({ title: 'Success', description: 'Script created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update script mutation
  const updateScriptMutation = useMutation({
    mutationFn: async (data: { id: number; scriptData: any }) => {
      const response = await fetch(`/api/python-scripts/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.scriptData),
      });
      if (!response.ok) throw new Error('Failed to update script');
      return response.json();
    },
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/python-scripts'] });
        setIsEditDialogOpen(false);
      });
      toast({ title: 'Success', description: 'Script updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Execute script mutation
  const executeScriptMutation = useMutation({
    mutationFn: async (data: { scriptId: number; inputs?: any }) => {
      const response = await fetch(`/api/python-scripts/${data.scriptId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: data.inputs }),
      });
      if (!response.ok) throw new Error('Failed to execute script');
      return response.json();
    },
    onSuccess: (result) => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/script-executions'] });
        setExecutionResult(result);
        // Don't close dialog immediately, show results first
      });
      toast({ title: 'Success', description: 'Script executed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete script mutation
  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: number) => {
      const response = await fetch(`/api/python-scripts/${scriptId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete script');
      }
      return response.json();
    },
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/python-scripts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/script-executions'] });
      });
      toast({ title: 'Success', description: 'Script deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Filter scripts
  const filteredScripts = scripts.filter((script: PythonScript) => {
    const matchesSearch = script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         script.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         script.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || script.status === statusFilter;
    const matchesTag = tagFilter === 'all' || script.tags.includes(tagFilter);
    
    return matchesSearch && matchesStatus && matchesTag;
  });

  // Get unique tags for filter
  const allTags = [...new Set(scripts.flatMap((script: PythonScript) => script.tags))];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'deprecated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Show loading state while initializing
  if (!isReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-lg text-gray-700">Loading pythonAI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="flex h-14 items-center px-4">
          <Link href="/apps">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Apps
            </Button>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
              <Code className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">pythonAI</h1>
              <p className="text-sm text-muted-foreground">Python Script Management & Execution</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="executions">Run History</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Scripts Tab */}
          <TabsContent value="scripts" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search scripts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    New Script
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Python Script</DialogTitle>
                    <DialogDescription>
                      Upload a new Python script or create one from scratch.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateScriptForm onSubmit={(data) => createScriptMutation.mutate(data)} />
                </DialogContent>
              </Dialog>
            </div>

            {/* Scripts Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scriptsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredScripts.length > 0 ? (
                filteredScripts.map((script: PythonScript) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    onExecute={(script) => {
                      setSelectedScript(script);
                      setIsExecuteDialogOpen(true);
                    }}
                    onEdit={(script) => {
                      setSelectedScript(script);
                      setIsEditDialogOpen(true);
                    }}
                    onDelete={(script) => deleteScriptMutation.mutate(script.id)}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Code className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No scripts found</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first Python script.</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Create Script
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Executions Tab */}
          <TabsContent value="executions" className="space-y-4">
            <ExecutionHistory executions={executions} loading={executionsLoading} />
          </TabsContent>

          {/* Schedules Tab */}
          <TabsContent value="schedules" className="space-y-4">
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Script Scheduling</h3>
              <p className="text-gray-500">Schedule your Python scripts to run automatically.</p>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="text-center py-12">
              <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Python Environment Settings</h3>
              <p className="text-gray-500">Configure Python runtime and environment settings.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Script Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Python Script</DialogTitle>
            <DialogDescription>
              Modify your Python script details and code.
            </DialogDescription>
          </DialogHeader>
          {selectedScript && (
            <EditScriptForm 
              script={selectedScript}
              onSubmit={(data) => updateScriptMutation.mutate({ id: selectedScript.id, scriptData: data })} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Execute Script Dialog */}
      <Dialog open={isExecuteDialogOpen} onOpenChange={(open) => {
        setIsExecuteDialogOpen(open);
        if (!open) {
          setExecutionResult(null); // Clear results when dialog closes
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execute Script</DialogTitle>
            <DialogDescription>
              Run {selectedScript?.name} with optional parameters.
            </DialogDescription>
          </DialogHeader>
          
          {!executionResult ? (
            <ExecuteScriptForm
              script={selectedScript}
              onSubmit={(inputs) => {
                if (selectedScript) {
                  executeScriptMutation.mutate({ scriptId: selectedScript.id, inputs });
                }
              }}
            />
          ) : (
            <div className="space-y-4">
              {/* Execution Results */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Execution Results</h4>
                  <div className="flex items-center space-x-2">
                    {executionResult.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <Badge variant={executionResult.status === 'completed' ? 'default' : 'destructive'}>
                      {executionResult.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="font-medium">Duration:</span> {executionResult.duration}ms
                  </div>
                  <div>
                    <span className="font-medium">Exit Code:</span> {executionResult.exitCode}
                  </div>
                  <div>
                    <span className="font-medium">Started:</span> {new Date(executionResult.startedAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Completed:</span> {new Date(executionResult.completedAt).toLocaleString()}
                  </div>
                </div>

                {/* Standard Output */}
                {executionResult.stdout && (
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block">Standard Output</Label>
                    <div className="bg-black text-green-400 p-3 rounded font-mono text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {executionResult.stdout}
                    </div>
                  </div>
                )}

                {/* Standard Error */}
                {executionResult.stderr && (
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block">Standard Error</Label>
                    <div className="bg-black text-red-400 p-3 rounded font-mono text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {executionResult.stderr}
                    </div>
                  </div>
                )}

                {/* Input Parameters */}
                {executionResult.inputs && Object.keys(executionResult.inputs).length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Input Parameters</Label>
                    <div className="bg-white p-3 rounded border font-mono text-sm">
                      <pre>{JSON.stringify(executionResult.inputs, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setExecutionResult(null)}
                >
                  Run Again
                </Button>
                <Button onClick={() => setIsExecuteDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Script Card Component
function ScriptCard({ script, onExecute, onEdit, onDelete }: {
  script: PythonScript;
  onExecute: (script: PythonScript) => void;
  onEdit: (script: PythonScript) => void;
  onDelete: (script: PythonScript) => void;
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-medium group-hover:text-blue-600 transition-colors">
              {script.name}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {script.description || 'No description'}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(script.status)} variant="secondary">
            {script.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Tags */}
        {script.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {script.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-2 py-0.5">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {script.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{script.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Script Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <User className="h-3 w-3 mr-1" />
              {script.owner?.firstName} {script.owner?.lastName}
            </span>
            <span className="flex items-center">
              <GitCommit className="h-3 w-3 mr-1" />
              v{script.version}
            </span>
          </div>
          <span>
            {script.lastRunAt ? format(new Date(script.lastRunAt), 'MMM d, HH:mm') : 'Never run'}
          </span>
        </div>

        {/* Requirements */}
        {script.requirements.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Requirements:</span> {script.requirements.slice(0, 2).join(', ')}
            {script.requirements.length > 2 && ` +${script.requirements.length - 2}`}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={() => onExecute(script)}>
              <Play className="h-3 w-3 mr-1" />
              Run
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(script)}>
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExecute(script)}>
                <Play className="h-4 w-4 mr-2" />
                Run Script
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(script)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Script
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Script
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Script</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{script.name}"? This action cannot be undone. 
                      All execution history and script versions will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onDelete(script)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function for status colors
function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'draft': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
    case 'deprecated': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
}

// Create Script Form Component with File Upload
function CreateScriptForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n"""\nScript Description\n"""\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n',
    tags: [] as string[],
    requirements: [] as string[],
  });

  const [tagInput, setTagInput] = useState('');
  const [reqInput, setReqInput] = useState('');
  const [uploadMode, setUploadMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const addRequirement = () => {
    if (reqInput.trim() && !formData.requirements.includes(reqInput.trim())) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, reqInput.trim()]
      }));
      setReqInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const removeRequirement = (req: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter(r => r !== req)
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.name.endsWith('.py') || file.name.endsWith('.txt'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          name: prev.name || file.name,
          content: content
        }));
        setUploadMode(false); // Switch back to text area to show content
      };
      reader.readAsText(file);
      toast({ title: 'Success', description: `File "${file.name}" uploaded successfully` });
    } else {
      toast({ 
        title: 'Error', 
        description: 'Please upload a valid Python (.py) or text (.txt) file', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Script Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="my_script.py"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of what this script does"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="content">Python Code</Label>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUploadMode(!uploadMode)}
            >
              {uploadMode ? (
                <>
                  <Edit className="h-4 w-4 mr-1" />
                  Manual Entry
                </>
              ) : (
                <>
                  <FilePlus className="h-4 w-4 mr-1" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </div>
        
        {uploadMode ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                accept=".py,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <div className="text-sm text-gray-600">
                  Click to upload a Python or text file
                </div>
                <div className="text-xs text-gray-500">
                  Supports .py and .txt files
                </div>
              </label>
            </div>
            {formData.content && formData.content !== '#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n"""\nScript Description\n"""\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n' && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                ✓ File uploaded successfully! You can switch to manual entry to edit the code.
              </div>
            )}
          </div>
        ) : (
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Enter your Python code here..."
            className="font-mono text-sm min-h-[200px]"
            required
          />
        )}
      </div>

      <div>
        <Label>Tags</Label>
        <div className="flex items-center space-x-2 mb-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" size="sm" onClick={addTag}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label>Requirements</Label>
        <div className="flex items-center space-x-2 mb-2">
          <Input
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            placeholder="requests==2.28.1"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
          />
          <Button type="button" size="sm" onClick={addRequirement}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.requirements.map(req => (
            <Badge key={req} variant="outline" className="cursor-pointer" onClick={() => removeRequirement(req)}>
              {req} ×
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline">Cancel</Button>
        <Button type="submit">Create Script</Button>
      </div>
    </form>
  );
}

// Edit Script Form Component
function EditScriptForm({ script, onSubmit }: { script: PythonScript; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: script.name,
    description: script.description || '',
    content: script.content,
    tags: script.tags || [],
    requirements: script.requirements || [],
    status: script.status || 'draft',
    gitBranch: script.gitBranch || 'main'
  });

  const [tagInput, setTagInput] = useState('');
  const [reqInput, setReqInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const addRequirement = () => {
    if (reqInput.trim() && !formData.requirements.includes(reqInput.trim())) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, reqInput.trim()]
      }));
      setReqInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const removeRequirement = (req: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter(r => r !== req)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Script Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="my_script.py"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of what this script does"
        />
      </div>

      <div>
        <Label htmlFor="content">Python Code</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Enter your Python code here..."
          className="font-mono text-sm min-h-[200px]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
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
      </div>

      <div>
        <Label>Tags</Label>
        <div className="flex items-center space-x-2 mb-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" size="sm" onClick={addTag}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label>Requirements</Label>
        <div className="flex items-center space-x-2 mb-2">
          <Input
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            placeholder="requests==2.28.1"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
          />
          <Button type="button" size="sm" onClick={addRequirement}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.requirements.map(req => (
            <Badge key={req} variant="outline" className="cursor-pointer" onClick={() => removeRequirement(req)}>
              {req} ×
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline">Cancel</Button>
        <Button type="submit">Update Script</Button>
      </div>
    </form>
  );
}

// Execute Script Form Component
function ExecuteScriptForm({ script, onSubmit }: { script: PythonScript | null; onSubmit: (inputs: any) => void }) {
  const [inputs, setInputs] = useState({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(inputs);
  };

  if (!script) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">{script.name}</h4>
        <p className="text-sm text-muted-foreground mb-2">{script.description}</p>
        {script.requirements.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Requirements:</span> {script.requirements.join(', ')}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="inputs">Runtime Parameters (JSON)</Label>
        <Textarea
          id="inputs"
          value={JSON.stringify(inputs, null, 2)}
          onChange={(e) => {
            try {
              setInputs(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"param1": "value1", "param2": 123}'
          className="font-mono text-sm"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline">Cancel</Button>
        <Button type="submit">
          <Play className="h-4 w-4 mr-2" />
          Execute
        </Button>
      </div>
    </form>
  );
}

// Execution History Component with Download Functionality
function ExecutionHistory({ executions, loading }: { executions: ScriptExecution[]; loading: boolean }) {
  const [selectedExecution, setSelectedExecution] = useState<ScriptExecution | null>(null);

  const downloadExecutionLog = (execution: ScriptExecution) => {
    const timestamp = new Date(execution.startedAt || execution.createdAt).toISOString().replace(/[:.]/g, '-');
    const scriptName = execution.script?.name || `script-${execution.scriptId}`;
    const filename = `${scriptName}-execution-${execution.id}-${timestamp}.txt`;
    
    let content = `Execution Log for ${execution.script?.name || `Script #${execution.scriptId}`}\n`;
    content += `${'='.repeat(60)}\n\n`;
    content += `Execution ID: ${execution.id}\n`;
    content += `Script ID: ${execution.scriptId}\n`;
    content += `Status: ${execution.status}\n`;
    content += `Triggered By: ${execution.triggeredByUser?.firstName} ${execution.triggeredByUser?.lastName}\n`;
    content += `Started At: ${new Date(execution.startedAt || execution.createdAt).toLocaleString()}\n`;
    content += `Completed At: ${execution.completedAt ? new Date(execution.completedAt).toLocaleString() : 'N/A'}\n`;
    content += `Duration: ${execution.duration || 0}ms\n`;
    content += `Exit Code: ${execution.exitCode !== null ? execution.exitCode : 'N/A'}\n`;
    content += `Scheduled: ${execution.isScheduled ? 'Yes' : 'No'}\n\n`;

    if (execution.inputs && Object.keys(execution.inputs).length > 0) {
      content += `Input Parameters:\n`;
      content += `${'-'.repeat(20)}\n`;
      content += `${JSON.stringify(execution.inputs, null, 2)}\n\n`;
    }

    if (execution.stdout) {
      content += `Standard Output:\n`;
      content += `${'-'.repeat(20)}\n`;
      content += `${execution.stdout}\n\n`;
    }

    if (execution.stderr) {
      content += `Standard Error:\n`;
      content += `${'-'.repeat(20)}\n`;
      content += `${execution.stderr}\n\n`;
    }

    content += `Generated by AdvancementAI pythonAI on ${new Date().toLocaleString()}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllExecutions = (executions: ScriptExecution[]) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `all-executions-${timestamp}.txt`;
    
    let content = `Execution History Report\n`;
    content += `${'='.repeat(60)}\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Total Executions: ${executions.length}\n\n`;

    executions.forEach((execution, index) => {
      content += `\n${'#'.repeat(40)}\n`;
      content += `Execution ${index + 1} of ${executions.length}\n`;
      content += `${'#'.repeat(40)}\n\n`;
      
      content += `Execution ID: ${execution.id}\n`;
      content += `Script: ${execution.script?.name || `Script #${execution.scriptId}`}\n`;
      content += `Status: ${execution.status}\n`;
      content += `Triggered By: ${execution.triggeredByUser?.firstName} ${execution.triggeredByUser?.lastName}\n`;
      content += `Started At: ${new Date(execution.startedAt || execution.createdAt).toLocaleString()}\n`;
      content += `Completed At: ${execution.completedAt ? new Date(execution.completedAt).toLocaleString() : 'N/A'}\n`;
      content += `Duration: ${execution.duration || 0}ms\n`;
      content += `Exit Code: ${execution.exitCode !== null ? execution.exitCode : 'N/A'}\n\n`;

      if (execution.inputs && Object.keys(execution.inputs).length > 0) {
        content += `Input Parameters:\n${JSON.stringify(execution.inputs, null, 2)}\n\n`;
      }

      if (execution.stdout) {
        content += `Standard Output:\n${execution.stdout}\n\n`;
      }

      if (execution.stderr) {
        content += `Standard Error:\n${execution.stderr}\n\n`;
      }
    });

    content += `\nReport generated by AdvancementAI pythonAI on ${new Date().toLocaleString()}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading execution history...</p>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No executions yet</h3>
        <p className="text-gray-500">Run a script to see execution history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Execution History</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{executions.length} executions</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadAllExecutions(executions)}
            className="flex items-center space-x-1"
          >
            <Download className="h-4 w-4" />
            <span>Download All</span>
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        {executions.map((execution) => (
          <Card key={execution.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {execution.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : execution.status === 'failed' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  )}
                  <Badge variant={execution.status === 'completed' ? 'default' : 'destructive'}>
                    {execution.status}
                  </Badge>
                </div>
                <div>
                  <div className="font-medium">
                    {execution.script?.name || `Script ID: ${execution.scriptId}`}
                  </div>
                  <div className="text-sm text-gray-500">
                    {execution.duration ? `${execution.duration}ms` : 'Duration unknown'}
                    {execution.exitCode !== null && ` • Exit code: ${execution.exitCode}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-500">
                  {format(new Date(execution.createdAt), 'MMM d, HH:mm')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadExecutionLog(execution)}
                  className="flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Execution Details Dialog */}
      {selectedExecution && (
        <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Execution Details</DialogTitle>
              <DialogDescription>
                Detailed information about the script execution.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">Script:</span> {selectedExecution.script?.name}</div>
                <div><span className="font-medium">Status:</span> {selectedExecution.status}</div>
                <div><span className="font-medium">Duration:</span> {selectedExecution.duration}ms</div>
                <div><span className="font-medium">Exit Code:</span> {selectedExecution.exitCode}</div>
                <div><span className="font-medium">Started:</span> {new Date(selectedExecution.startedAt || selectedExecution.createdAt).toLocaleString()}</div>
                <div><span className="font-medium">Completed:</span> {selectedExecution.completedAt ? new Date(selectedExecution.completedAt).toLocaleString() : 'N/A'}</div>
              </div>

              {selectedExecution.stdout && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Standard Output</Label>
                  <ScrollArea className="h-48 w-full rounded border bg-black p-3">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                      {selectedExecution.stdout}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {selectedExecution.stderr && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Standard Error</Label>
                  <ScrollArea className="h-48 w-full rounded border bg-black p-3">
                    <pre className="text-red-400 text-sm font-mono whitespace-pre-wrap">
                      {selectedExecution.stderr}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {selectedExecution.inputs && Object.keys(selectedExecution.inputs).length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Input Parameters</Label>
                  <ScrollArea className="h-32 w-full rounded border bg-gray-50 p-3">
                    <pre className="text-sm font-mono">
                      {JSON.stringify(selectedExecution.inputs, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => downloadExecutionLog(selectedExecution)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Log
              </Button>
              <Button onClick={() => setSelectedExecution(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}