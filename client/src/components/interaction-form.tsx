import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, AlertCircle, CheckCircle, User, Calendar, Tag } from 'lucide-react';
import { validateSOPCompliance, type SOPValidationResult } from '@/lib/sop-validation';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ConstituentSearch } from './constituent-search';
import { BuidSearch } from './buid-search';

const formSchema = z.object({
  prospectName: z.string().min(1, 'Prospect name is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  buid: z.string().optional(),
  bbecGuid: z.string().optional(),
  constituentGuid: z.string().optional(),
  contactLevel: z.string().min(1, 'Contact level is required'),
  method: z.string().min(1, 'Method is required'),
  summary: z.string().min(1, 'Summary is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().min(1, 'Subcategory is required'),
  status: z.string().min(1, 'Status is required'),
  actualDate: z.string().min(1, 'Actual date is required'),
  comments: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

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

interface Constituent {
  uid: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  guid: string;
}

interface InteractionFormProps {
  isVisible: boolean;
  extractedInfo?: ExtractedInfo;
  existingInteraction?: any; // For editing existing interactions
  transcript?: string;
  enhancedComments?: string;
  onSubmit: (data: FormData & { affinityTags: string[] }) => void;
  onSaveDraft: (data: FormData & { affinityTags: string[] }) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function InteractionForm({
  isVisible,
  extractedInfo,
  existingInteraction,
  transcript,
  enhancedComments,
  onSubmit,
  onSaveDraft,
  onClose,
  isSubmitting = false
}: InteractionFormProps) {
  const [selectedAffinityTags, setSelectedAffinityTags] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<SOPValidationResult>({ isValid: true, errors: [], warnings: [] });
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prospectName: '',
      firstName: '',
      lastName: '',
      buid: '',
      bbecGuid: '',
      contactLevel: '',
      method: '',
      summary: '',
      category: '',
      subcategory: '',
      status: 'Complete',
      actualDate: new Date().toISOString().slice(0, 16),
      comments: '',
    }
  });

  // Pre-populate form with extracted information or existing interaction
  useEffect(() => {
    if (existingInteraction) {
      // Function to parse first and last name from prospect name
      const parseProspectName = (fullName: string) => {
        if (!fullName || fullName.trim().length === 0) return { firstName: '', lastName: '' };
        
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length === 1) {
          return { firstName: nameParts[0], lastName: '' };
        } else if (nameParts.length === 2) {
          return { firstName: nameParts[0], lastName: nameParts[1] };
        } else {
          // For names with more than 2 parts, assume first word is first name, rest is last name
          return { 
            firstName: nameParts[0], 
            lastName: nameParts.slice(1).join(' ') 
          };
        }
      };

      // If firstName and lastName are empty but prospectName exists, parse the name
      let firstName = existingInteraction.firstName || '';
      let lastName = existingInteraction.lastName || '';
      
      if ((!firstName && !lastName) && existingInteraction.prospectName) {
        const parsed = parseProspectName(existingInteraction.prospectName);
        firstName = parsed.firstName;
        lastName = parsed.lastName;
      }

      // Editing existing interaction
      form.reset({
        prospectName: existingInteraction.prospectName || '',
        firstName,
        lastName,
        buid: existingInteraction.buid || '',
        bbecGuid: existingInteraction.bbecGuid || '',
        summary: existingInteraction.summary || '',
        category: existingInteraction.category || '',
        subcategory: existingInteraction.subcategory || '',
        contactLevel: existingInteraction.contactLevel || '',
        method: existingInteraction.method || '',
        status: existingInteraction.status || 'Complete',
        actualDate: new Date(existingInteraction.actualDate).toISOString().slice(0, 16),
        comments: existingInteraction.comments || existingInteraction.transcript || '',
      });
      setSelectedAffinityTags(existingInteraction.affinityTags || []);
    } else if (extractedInfo) {
      // Function to parse first and last name from prospect name
      const parseProspectName = (fullName: string) => {
        if (!fullName || fullName.trim().length === 0) return { firstName: '', lastName: '' };
        
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length === 1) {
          return { firstName: nameParts[0], lastName: '' };
        } else if (nameParts.length === 2) {
          return { firstName: nameParts[0], lastName: nameParts[1] };
        } else {
          // For names with more than 2 parts, assume first word is first name, rest is last name
          return { 
            firstName: nameParts[0], 
            lastName: nameParts.slice(1).join(' ') 
          };
        }
      };

      // Parse first and last name from prospect name
      const prospectName = extractedInfo.prospectName || '';
      const { firstName, lastName } = parseProspectName(prospectName);

      // New interaction with AI extracted info
      form.reset({
        prospectName: prospectName,
        firstName: firstName,
        lastName: lastName,
        buid: '',
        bbecGuid: '',
        summary: extractedInfo.summary,
        category: extractedInfo.category,
        subcategory: extractedInfo.subcategory,
        contactLevel: 'Face-to-face', // Default based on most interactions
        method: 'In-person meeting',
        status: 'Complete',
        actualDate: new Date().toISOString().slice(0, 16),
        comments: enhancedComments || transcript || '',
      });
      setSelectedAffinityTags(extractedInfo.suggestedAffinityTags || []);
    } else {
      // New interaction without extracted info - reset to default values
      form.reset({
        prospectName: '',
        firstName: '',
        lastName: '',
        buid: '',
        bbecGuid: '',
        summary: '',
        category: '',
        subcategory: '',
        contactLevel: '',
        method: '',
        status: 'Complete',
        actualDate: new Date().toISOString().slice(0, 16),
        comments: '',
      });
      setSelectedAffinityTags([]);
    }
  }, [extractedInfo, existingInteraction, enhancedComments, transcript, form]);

  // Validate form data whenever it changes
  useEffect(() => {
    const subscription = form.watch((data) => {
      const validationData = {
        ...data,
        affinityTags: selectedAffinityTags,
        owner: 'sarah.thompson' // Current user
      };
      const result = validateSOPCompliance(validationData);
      setValidationResult(result);
    });

    return () => subscription.unsubscribe();
  }, [form, selectedAffinityTags]);

  const removeAffinityTag = (tagToRemove: string) => {
    setSelectedAffinityTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = (data: FormData) => {
    const submissionData = {
      ...data,
      affinityTags: selectedAffinityTags
    };
    
    const validation = validateSOPCompliance({
      ...submissionData,
      owner: 'sarah.thompson'
    });

    if (validation.isValid) {
      onSubmit(submissionData);
    } else {
      setValidationResult(validation);
    }
  };

  const handleSaveDraft = () => {
    const data = form.getValues();
    onSaveDraft({
      ...data,
      affinityTags: selectedAffinityTags
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-end sm:items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Review & Submit Interaction</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {/* AI Analysis Results */}
            {extractedInfo && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    AI Analysis Complete
                  </h4>
                  <div className="space-y-3 text-sm">
                    {extractedInfo.professionalInterests.length > 0 && (
                      <div>
                        <span className="font-medium text-blue-800">Professional Interests: </span>
                        <span className="text-blue-700">{extractedInfo.professionalInterests.join(', ')}</span>
                      </div>
                    )}
                    {extractedInfo.personalInterests.length > 0 && (
                      <div>
                        <span className="font-medium text-blue-800">Personal Interests: </span>
                        <span className="text-blue-700">{extractedInfo.personalInterests.join(', ')}</span>
                      </div>
                    )}
                    {extractedInfo.philanthropicPriorities.length > 0 && (
                      <div>
                        <span className="font-medium text-blue-800">Philanthropic Priorities: </span>
                        <span className="text-blue-700">{extractedInfo.philanthropicPriorities.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Validation Results */}
            {validationResult.errors.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="font-medium mb-2">SOP Validation Errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.warnings.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <div className="font-medium mb-2">SOP Warnings:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Prospect Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Prospect Information
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="prospectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prospect Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter prospect name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter first name" />
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
                          <div className="flex space-x-2">
                            <FormControl>
                              <Input {...field} placeholder="Enter last name" />
                            </FormControl>
                            <ConstituentSearch
                              lastName={field.value || ''}
                              onSelectConstituent={(constituent) => {
                                form.setValue("firstName", constituent.first_name || '');
                                form.setValue("lastName", constituent.last_name || '');
                                form.setValue("buid", constituent.uid || '');
                                form.setValue("bbecGuid", constituent.guid || '');
                              }}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="buid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>BUID</FormLabel>
                          <div className="flex space-x-2">
                            <FormControl>
                              <Input {...field} placeholder="Blackbaud User ID" />
                            </FormControl>
                            <BuidSearch
                              buid={field.value || ''}
                              onSelectConstituent={(constituent) => {
                                form.setValue("firstName", constituent.first_name || '');
                                form.setValue("lastName", constituent.last_name || '');
                                form.setValue("buid", constituent.uid || '');
                                form.setValue("bbecGuid", constituent.guid || '');
                                form.setValue("constituentGuid", constituent.guid || '');
                              }}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bbecGuid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>BBEC GUID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Blackbaud GUID" readOnly />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Interaction Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Interaction Details
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Level *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select contact level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Face-to-face">Face-to-face</SelectItem>
                              <SelectItem value="Phone">Phone</SelectItem>
                              <SelectItem value="Email">Email</SelectItem>
                              <SelectItem value="Video call">Video call</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Method *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="In-person meeting">In-person meeting</SelectItem>
                              <SelectItem value="Phone call">Phone call</SelectItem>
                              <SelectItem value="Email exchange">Email exchange</SelectItem>
                              <SelectItem value="Video conference">Video conference</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Cultivation">Cultivation</SelectItem>
                              <SelectItem value="Stewardship">Stewardship</SelectItem>
                              <SelectItem value="Solicitation">Solicitation</SelectItem>
                              <SelectItem value="Research">Research</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subcategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subcategory *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select subcategory" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Initial meeting">Initial meeting</SelectItem>
                              <SelectItem value="Follow-up">Follow-up</SelectItem>
                              <SelectItem value="Event attendance">Event attendance</SelectItem>
                              <SelectItem value="Presentation">Presentation</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Complete">Complete</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Declined">Declined</SelectItem>
                              <SelectItem value="Canceled">Canceled</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="actualDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Actual Date & Time *</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Brief interaction summary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Affinity Tags */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <Tag className="h-4 w-4 mr-2" />
                    Matched Affinity Tags
                  </h3>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedAffinityTags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="flex items-center space-x-1"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeAffinityTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Comments */}
                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Detailed Comments</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const currentComments = form.getValues("comments");
                              
                              if (existingInteraction && existingInteraction.transcript) {
                                // Use existing transcript for AI analysis
                                const response = await apiRequest("POST", `/api/interactions/${existingInteraction.id}/regenerate-synopsis`);
                                const data = await response.json();
                                if (data.success) {
                                  form.setValue("comments", data.comments);
                                  toast({
                                    title: "AI Analysis Complete",
                                    description: "AI synopsis has been generated and added to comments.",
                                  });
                                }
                              } else if (currentComments && currentComments.trim().length > 0) {
                                // Perform AI analysis on current comments text
                                const response = await apiRequest("POST", "/api/interactions/analyze-text", {
                                  text: currentComments,
                                  prospectName: form.getValues("prospectName") || ''
                                });
                                const data = await response.json();
                                
                                if (data.extractedInfo) {
                                  // Update form fields with AI analysis results
                                  if (data.extractedInfo.summary) {
                                    form.setValue("summary", data.extractedInfo.summary);
                                  }
                                  if (data.extractedInfo.category) {
                                    form.setValue("category", data.extractedInfo.category);
                                  }
                                  if (data.extractedInfo.subcategory) {
                                    form.setValue("subcategory", data.extractedInfo.subcategory);
                                  }
                                  
                                  // Set suggested affinity tags
                                  if (data.extractedInfo.suggestedAffinityTags) {
                                    setSelectedAffinityTags(data.extractedInfo.suggestedAffinityTags);
                                  }
                                  
                                  toast({
                                    title: "AI Analysis Complete",
                                    description: "Summary, category, and affinity tags have been generated based on your comments.",
                                  });
                                }
                              } else {
                                toast({
                                  title: "No Content to Analyze",
                                  description: "Please add some detailed comments for AI analysis.",
                                  variant: "destructive",
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to perform AI analysis. Please try again.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="text-xs"
                        >
                          AI Analysis
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={8}
                          className="min-h-[200px] max-h-[400px] resize-y"
                          placeholder="Detailed interaction notes..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex space-x-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                  >
                    Save as Draft
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!validationResult.isValid || isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit to BBEC'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
