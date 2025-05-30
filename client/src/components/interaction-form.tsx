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

const formSchema = z.object({
  prospectName: z.string().min(1, 'Prospect name is required'),
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prospectName: '',
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
      // Editing existing interaction
      form.reset({
        prospectName: existingInteraction.prospectName || '',
        summary: existingInteraction.summary || '',
        category: existingInteraction.category || '',
        subcategory: existingInteraction.subcategory || '',
        contactLevel: existingInteraction.contactLevel || '',
        method: existingInteraction.method || '',
        status: existingInteraction.status || 'Complete',
        actualDate: new Date(existingInteraction.actualDate).toISOString().slice(0, 16),
        comments: existingInteraction.comments || '',
      });
      setSelectedAffinityTags(existingInteraction.affinityTags || []);
    } else if (extractedInfo) {
      // New interaction with AI extracted info
      form.reset({
        prospectName: extractedInfo.prospectName || '',
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
                      <FormLabel>Detailed Comments</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={4}
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
