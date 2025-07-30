import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const typeFormSchema = z.object({
  comments: z.string().min(10, 'Please provide detailed comments (at least 10 characters)'),
});

type TypeFormData = z.infer<typeof typeFormSchema>;

interface TypeInteractionFormProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete: (transcript: string, extractedInfo: any, enhancedComments: string) => void;
}

export function TypeInteractionForm({ isVisible, onClose, onComplete }: TypeInteractionFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const form = useForm<TypeFormData>({
    resolver: zodResolver(typeFormSchema),
    defaultValues: {
      comments: '',
    },
  });

  const handleSubmit = async (data: TypeFormData) => {
    setIsProcessing(true);
    
    try {
      // Process the typed content through AI analysis (same as voice workflow)
      const response = await apiRequest("POST", "/api/interactions/analyze-text", {
        text: data.comments,
        prospectName: '' // Will be extracted by AI
      });
      
      const analysisData = await response.json();
      
      if (analysisData.success && analysisData.extractedInfo) {
        const extractedInfo = analysisData.extractedInfo;
        
        // Generate enhanced comments with synopsis (same as voice workflow)
        try {
          const enhanceResponse = await apiRequest("POST", "/api/interactions/enhance-comments", {
            transcript: data.comments,
            extractedInfo: extractedInfo
          });
          const enhanceData = await enhanceResponse.json();
          
          const enhancedComments = enhanceData.enhancedComments || data.comments;
          
          // Call onComplete with the processed data - same as voice recording completion
          onComplete(data.comments, extractedInfo, enhancedComments);
          
          toast({
            title: "Processing Complete",
            description: "Your typed interaction has been analyzed and is ready for review.",
          });
          
          // Reset form and close
          form.reset();
          onClose();
          
        } catch (enhanceError) {
          // If enhancement fails, still proceed with basic extracted info
          onComplete(data.comments, extractedInfo, data.comments);
          
          toast({
            title: "Analysis Complete",
            description: "Your interaction has been analyzed and is ready for review.",
          });
          
          form.reset();
          onClose();
        }
        
      } else {
        toast({
          title: "Analysis Error",
          description: "Failed to analyze the typed content. Please try again.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error("Type interaction processing error:", error);
      toast({
        title: "Processing Error",
        description: "Failed to process your typed interaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-end sm:items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Type Interaction Details</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground">
              Type your detailed interaction notes below. Our AI will analyze the content and extract key information just like it does with voice recordings.
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Detailed Interaction Notes
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={12}
                          className="min-h-[300px] max-h-[400px] resize-y"
                          placeholder="Describe your interaction with the prospect in detail. Include:
• Who you met with and their background
• What was discussed (interests, priorities, concerns)
• Key points and insights
• Next steps or follow-up actions
• Any other relevant details

Example: 'Met with John Smith, BU alumnus and successful tech entrepreneur. He expressed strong interest in supporting computer science education, particularly scholarships for underrepresented students. He mentioned his startup just went public and he's looking to give back to his alma mater. We discussed the new CS building project and he seemed very engaged. He asked for a formal proposal and wants to meet again next month to discuss a potential major gift.'"
                          disabled={isProcessing}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isProcessing || !form.watch('comments')?.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Analyze & Continue
                      </>
                    )}
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