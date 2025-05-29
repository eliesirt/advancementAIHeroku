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
}

const defaultSteps: ProcessingStep[] = [
  { id: 'transcribe', label: 'Transcribing audio', status: 'pending' },
  { id: 'extract', label: 'Extracting key information', status: 'pending' },
  { id: 'match', label: 'Matching affinity tags', status: 'pending' },
  { id: 'enhance', label: 'Enhancing comments', status: 'pending' },
];

export function ProcessingOverlay({ 
  isVisible, 
  onComplete,
  steps = defaultSteps 
}: ProcessingOverlayProps) {
  const [currentSteps, setCurrentSteps] = useState<ProcessingStep[]>(steps);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      // Reset when overlay is hidden
      setCurrentSteps(steps.map(step => ({ ...step, status: 'pending' })));
      setCurrentStepIndex(0);
      return;
    }

    // Simulate processing steps
    const processSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        setCurrentStepIndex(i);
        
        // Mark current step as processing
        setCurrentSteps(prev => 
          prev.map((step, index) => ({
            ...step,
            status: index === i ? 'processing' : index < i ? 'complete' : 'pending'
          }))
        );

        // Simulate processing time (1-3 seconds per step)
        const processingTime = 1000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, processingTime));

        // Mark step as complete
        setCurrentSteps(prev => 
          prev.map((step, index) => ({
            ...step,
            status: index <= i ? 'complete' : 'pending'
          }))
        );
      }

      // All steps complete
      setTimeout(() => {
        onComplete?.();
      }, 500);
    };

    processSteps();
  }, [isVisible, steps, onComplete]);

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
