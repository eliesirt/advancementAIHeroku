import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/use-voice-recording';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioData: string, transcript: string, duration: number) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceRecorder({ 
  onRecordingComplete, 
  onError, 
  disabled = false,
  className 
}: VoiceRecorderProps) {
  const [transcript, setTranscript] = useState('');

  const { state, toggleRecording, resetRecording } = useVoiceRecording({
    onTranscriptUpdate: (newTranscript) => {
      setTranscript(prev => prev + newTranscript);
    },
    onRecordingComplete: (audioData, duration) => {
      onRecordingComplete(audioData, transcript, duration);
      setTranscript('');
    },
    onError
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!state.isSupported) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6 text-center">
          <div className="text-gray-500 mb-2">
            Voice recording is not supported in this browser
          </div>
          <p className="text-sm text-gray-400">
            Please try using Chrome, Edge, or Safari
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Voice Recording</h3>
          <p className="text-gray-600">
            {state.isRecording 
              ? "Recording... Speak clearly about your interaction" 
              : "Tap to start recording your interaction report"
            }
          </p>
          
          {/* Recording Button */}
          <div className="relative">
            <Button
              onClick={toggleRecording}
              disabled={disabled}
              size="lg"
              className={cn(
                "w-24 h-24 rounded-full transition-all duration-200",
                state.isRecording 
                  ? "animate-pulse" 
                  : ""
              )}
              style={{ 
                backgroundColor: '#CC0000',
                borderColor: '#CC0000'
              }}
            >
              {state.isRecording ? (
                <Square className="h-8 w-8 text-white" />
              ) : (
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 32 32" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  {/* Rhett Boston University Mascot - Simplified Terrier */}
                  <g fill="white">
                    {/* Head */}
                    <ellipse cx="16" cy="12" rx="8" ry="6"/>
                    {/* Ears */}
                    <ellipse cx="11" cy="8" rx="2" ry="3"/>
                    <ellipse cx="21" cy="8" rx="2" ry="3"/>
                    {/* Eyes */}
                    <circle cx="13" cy="11" r="1" fill="black"/>
                    <circle cx="19" cy="11" r="1" fill="black"/>
                    {/* Nose */}
                    <ellipse cx="16" cy="14" rx="1" ry="0.5" fill="black"/>
                    {/* Body */}
                    <ellipse cx="16" cy="22" rx="6" ry="5"/>
                    {/* Legs */}
                    <rect x="12" y="26" width="2" height="4" rx="1"/>
                    <rect x="18" y="26" width="2" height="4" rx="1"/>
                    {/* Tail */}
                    <ellipse cx="23" cy="20" rx="1.5" ry="3" transform="rotate(20 23 20)"/>
                  </g>
                </svg>
              )}
            </Button>
          </div>

          {/* Recording Duration */}
          {state.isRecording && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-lg font-mono text-red-600">
                {formatDuration(state.duration)}
              </span>
            </div>
          )}

          {/* Live Transcript */}
          {(state.isRecording || transcript) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Live Transcript</h4>
                {transcript && (
                  <Badge variant="secondary">
                    {transcript.split(' ').length} words
                  </Badge>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-24 text-left">
                {transcript ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{transcript}</p>
                ) : state.isRecording ? (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Listening...</span>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">Your transcript will appear here...</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {transcript && !state.isRecording && (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTranscript('');
                  resetRecording();
                }}
              >
                Clear
              </Button>
              <Button
                onClick={toggleRecording}
                disabled={disabled}
              >
                <Mic className="h-4 w-4 mr-2" />
                Record More
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
