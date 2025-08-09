import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Mic, Volume2, X } from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';
import { createDefaultVoiceCommands, type VoiceCommandManager } from '@/lib/voice-commands';

interface DrivingModeProps {
  isActive: boolean;
  onExit: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmitInteraction: () => void;
  onShowSettings: () => void;
}

export function DrivingMode({
  isActive,
  onExit,
  onStartRecording,
  onStopRecording,
  onSubmitInteraction,
  onShowSettings
}: DrivingModeProps) {
  const [voiceCommands, setVoiceCommands] = useState<VoiceCommandManager | null>(null);
  const [recognizedCommand, setRecognizedCommand] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  
  const { speak, stop: stopSpeech } = useSpeechSynthesis({
    rate: 0.9,
    volume: 0.8
  });

  useEffect(() => {
    if (isActive) {
      // Initialize voice commands
      const commandManager = createDefaultVoiceCommands({
        onLogInteraction: () => {
          speak('Starting interaction recording');
          onStartRecording();
        },
        onStopRecording: () => {
          speak('Stopping recording');
          onStopRecording();
        },
        onSubmitInteraction: () => {
          speak('Submitting interaction to Blackbaud CRM');
          onSubmitInteraction();
        },
        onExitDrivingMode: () => {
          speak('Exiting driving mode');
          onExit();
        },
        onShowSettings: () => {
          speak('Opening settings');
          onShowSettings();
        }
      });

      setVoiceCommands(commandManager);

      // Welcome message
      speak('Driving mode activated. Voice commands are now active. Say "log interaction" to start recording.');

      // Start listening for commands
      if (commandManager.isSupported()) {
        commandManager.startListening((command) => {
          setRecognizedCommand(command);
          setTimeout(() => setRecognizedCommand(''), 3000);
        });
        setIsListening(true);
      }

      return () => {
        commandManager?.stopListening();
        stopSpeech();
      };
    } else {
      voiceCommands?.stopListening();
      setIsListening(false);
      stopSpeech();
    }
  }, [isActive, speak, stopSpeech, onStartRecording, onStopRecording, onSubmitInteraction, onExit, onShowSettings]);

  if (!isActive) {
    return null;
  }

  const availableCommands = voiceCommands?.getCommands() || [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col text-white" style={{ background: 'linear-gradient(to bottom right, #CC0000, #990000)' }}>
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <div className="bg-white rounded-sm p-2 w-16 h-8">
            <img 
              src="/bu-logo.png"
              alt="Boston University Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Driving Mode</h1>
        <p className="text-red-100 text-lg">Hands-free voice control active</p>
      </div>

      {/* Voice Status */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm mb-8">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className={`w-4 h-4 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-lg font-medium">
                {isListening ? 'Listening for commands...' : 'Voice commands disabled'}
              </span>
            </div>
            
            {recognizedCommand && (
              <div className="bg-white/20 rounded-lg p-3 mb-4">
                <p className="text-sm opacity-75">Last command:</p>
                <p className="font-medium">"{recognizedCommand}"</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-red-100">Say one of these commands:</p>
              <div className="text-left space-y-1">
                <div className="font-medium">"Log interaction" - Start recording</div>
                <div className="font-medium">"Stop recording" - End session</div>
                <div className="font-medium">"Submit interaction" - Save to BBEC</div>
                <div className="font-medium">"Exit driving mode" - Return to normal</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Indicator */}
        <div className="w-32 h-32 border-4 border-white/30 rounded-full flex items-center justify-center mb-8">
          <div className={`w-24 h-24 bg-white/20 rounded-full flex items-center justify-center ${isListening ? 'animate-pulse' : ''}`}>
            {isListening ? (
              <Mic className="h-12 w-12" />
            ) : (
              <Volume2 className="h-12 w-12" />
            )}
          </div>
        </div>

        {/* Safety Message */}
        <div className="text-center">
          <p className="text-red-100 text-sm font-medium mb-2">Keep your eyes on the road</p>
          <p className="text-red-200 text-xs">Use voice commands only when safe to do so</p>
        </div>
      </div>

      {/* Exit Button */}
      <div className="p-6">
        <Button
          onClick={onExit}
          variant="outline"
          className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white py-4 text-lg"
        >
          <X className="h-5 w-5 mr-2" />
          Exit Driving Mode
        </Button>
      </div>

      {/* Available Commands Reference */}
      {availableCommands.length > 0 && (
        <Card className="mx-6 mb-6 bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center">
              <Mic className="h-4 w-4 mr-2" />
              Available Voice Commands
            </h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {availableCommands.slice(0, 6).map((command, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="font-medium">"{command.patterns[0]}"</span>
                  <span className="text-red-200 text-xs">{command.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
