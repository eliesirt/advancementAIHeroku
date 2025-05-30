import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Zap, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Interaction } from "@shared/schema";

interface BulkProcessorProps {
  selectedInteractions: Interaction[];
  onClearSelection: () => void;
}

interface BulkProcessResult {
  id: number;
  success: boolean;
  affinityTagsMatched?: number;
  message?: string;
  error?: string;
}

interface BulkProcessResponse {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  totalAffinityTagsMatched: number;
  results: BulkProcessResult[];
}

export function BulkProcessor({ selectedInteractions, onClearSelection }: BulkProcessorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<BulkProcessResponse | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bulkProcessMutation = useMutation({
    mutationFn: async (interactionIds: number[]) => {
      const response = await apiRequest("POST", "/api/interactions/bulk-process", {
        interactionIds
      });
      return response as unknown as BulkProcessResponse;
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/interactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: "Bulk Processing Complete",
        description: `Processed ${data.successful}/${data.processed} interactions with ${data.totalAffinityTagsMatched} total affinity tags matched.`
      });
    },
    onError: (error) => {
      toast({
        title: "Bulk Processing Failed",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const handleProcess = () => {
    const interactionIds = selectedInteractions.map(i => i.id);
    bulkProcessMutation.mutate(interactionIds);
  };

  const handleClose = () => {
    setIsOpen(false);
    setResults(null);
    onClearSelection();
  };

  if (selectedInteractions.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="fixed bottom-20 right-4 rounded-full shadow-lg z-10" size="lg">
          <Zap className="h-4 w-4 mr-2" />
          Process {selectedInteractions.length} Interactions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Bulk Processing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!results && !bulkProcessMutation.isPending && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h3 className="font-medium mb-2">What will be processed:</h3>
                <ul className="text-sm space-y-1">
                  <li>• AI analysis for interactions with transcripts</li>
                  <li>• Affinity tag matching based on extracted interests</li>
                  <li>• Enhanced synopsis generation</li>
                  <li>• Automatic categorization updates</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Selected Interactions ({selectedInteractions.length}):</h3>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectedInteractions.map(interaction => (
                    <div key={interaction.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="font-medium">{interaction.prospectName}</div>
                      <div className="text-gray-600 dark:text-gray-400">{interaction.summary}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProcess}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              </div>
            </div>
          )}

          {bulkProcessMutation.isPending && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="font-medium">Processing Interactions...</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This may take a few moments depending on the number of interactions
                </p>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                  <div className="text-sm text-green-700 dark:text-green-300">Successful</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                  <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Tags className="h-5 w-5 text-blue-600" />
                  <span className="text-lg font-bold text-blue-600">{results.totalAffinityTagsMatched}</span>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Total Affinity Tags Matched</div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Processing Results:</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {results.results.map(result => {
                    const interaction = selectedInteractions.find(i => i.id === result.id);
                    return (
                      <div key={result.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{interaction?.prospectName}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {result.success ? (
                              `${result.affinityTagsMatched} affinity tags matched`
                            ) : (
                              result.error
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}