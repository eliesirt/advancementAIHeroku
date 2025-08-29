import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, Clock, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  duration?: number;
}

interface ProcessingOverlayProps {
  isVisible: boolean;
  onComplete?: () => void;
  steps?: ProcessingStep[];
  aiModel?: string;
  completeImmediately?: boolean;
}

const defaultSteps: ProcessingStep[] = [
  { id: 'transcribe', label: 'Transcribing audio with OpenAI Whisper', status: 'pending' },
  { id: 'extract', label: 'Extracting key information with GPT-5', status: 'pending' },
  { id: 'match', label: 'Matching affinity tags', status: 'pending' },
  { id: 'enhance', label: 'Enhancing comments with AI', status: 'pending' },
  { id: 'finalize', label: 'Preparing interaction form', status: 'pending' },
];

export function ProcessingOverlay({ 
  isVisible, 
  onComplete,
  steps = defaultSteps,
  aiModel = "GPT-5",
  completeImmediately = false
}: ProcessingOverlayProps) {
  const [currentSteps, setCurrentSteps] = useState<ProcessingStep[]>(steps);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Create dynamic steps with the actual AI model
  const dynamicSteps: ProcessingStep[] = [
    { id: 'transcribe', label: 'Transcribing audio with OpenAI Whisper', status: 'pending' },
    { id: 'extract', label: `Extracting key information with ${aiModel}`, status: 'pending' },
    { id: 'match', label: 'Matching affinity tags', status: 'pending' },
    { id: 'enhance', label: `Enhancing comments with ${aiModel}`, status: 'pending' },
    { id: 'finalize', label: 'Preparing interaction form', status: 'pending' },
  ];

  useEffect(() => {
    if (!isVisible) {
      // Reset when overlay is hidden
      setCurrentSteps(dynamicSteps.map(step => ({ ...step, status: 'pending' })));
      setCurrentStepIndex(0);
      return;
    }

    // Start with first step processing immediately
    setCurrentStepIndex(0);
    setCurrentSteps(prev => 
      prev.map((step, index) => ({
        ...step,
        status: index === 0 ? 'processing' : 'pending'
      }))
    );

    // Simulate realistic progress through steps while waiting for actual API
    const progressSteps = async () => {
      // Step 1: Transcribing (immediate)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCurrentStepIndex(1);
      setCurrentSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index === 0 ? 'complete' : index === 1 ? 'processing' : 'pending'
        }))
      );

      // Step 2: Extracting (after a delay)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setCurrentStepIndex(2);
      setCurrentSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index <= 1 ? 'complete' : index === 2 ? 'processing' : 'pending'
        }))
      );

      // Step 3: Matching (after another delay)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCurrentStepIndex(3);
      setCurrentSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index <= 2 ? 'complete' : index === 3 ? 'processing' : 'pending'
        }))
      );

      // Step 4: Enhancing (final processing step)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCurrentStepIndex(4);
      setCurrentSteps(prev => 
        prev.map((step, index) => ({
          ...step,
          status: index <= 3 ? 'complete' : index === 4 ? 'processing' : 'pending'
        }))
      );

      // Keep step 4 (Preparing form) processing until parent tells us to complete
      // Parent component will call onComplete when API actually finishes
    };

    progressSteps();
  }, [isVisible, dynamicSteps]);

  // Effect to handle immediate completion when API finishes
  useEffect(() => {
    if (completeImmediately && isVisible) {
      console.log("API completed - finishing all processing steps immediately");
      // Complete all steps immediately
      setCurrentSteps(prev => 
        prev.map(step => ({ ...step, status: 'complete' }))
      );
      setCurrentStepIndex(dynamicSteps.length - 1);
    }
  }, [completeImmediately, isVisible, dynamicSteps]);

  if (!isVisible) {
    return null;
  }

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <Clock className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Processing Interaction
            </h3>
            <div className="mb-2">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                Powered by {aiModel}
              </span>
            </div>
            <p className="text-gray-600">
              AI is analyzing your report and extracting key information...
            </p>
          </div>

          <div className="space-y-3">
            {currentSteps.map((step, index) => (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg transition-colors",
                  step.status === 'processing' && "bg-blue-50",
                  step.status === 'complete' && "bg-green-50"
                )}
              >
                {getStepIcon(step)}
                <span 
                  className={cn(
                    "flex-1 text-sm",
                    step.status === 'complete' && "text-green-700",
                    step.status === 'processing' && "text-blue-700 font-medium",
                    step.status === 'pending' && "text-gray-500"
                  )}
                >
                  {step.label}
                </span>
                {step.status === 'processing' && (
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${((currentStepIndex + 1) / currentSteps.length) * 100}%` 
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
