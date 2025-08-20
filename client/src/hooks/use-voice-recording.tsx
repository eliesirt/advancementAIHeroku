import { useState, useRef, useCallback } from 'react';

interface UseVoiceRecordingProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onRecordingComplete?: (audioData: string, transcript: string, duration: number) => void;
  onError?: (error: string) => void;
}

export interface VoiceRecordingState {
  isRecording: boolean;
  duration: number;
  transcript: string;
  isSupported: boolean;
}

export function useVoiceRecording({
  onTranscriptUpdate,
  onRecordingComplete,
  onError
}: UseVoiceRecordingProps = {}) {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    duration: 0,
    transcript: '',
    isSupported: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentTranscriptRef = useRef<string>('');

  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          // Use the current transcript from ref which has the latest accumulated text
          setState(prevState => {
            onRecordingComplete?.(base64Audio, currentTranscriptRef.current, prevState.duration);
            return prevState;
          });
        };
        reader.readAsDataURL(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      // Set up Speech Recognition (optional - recording will work without it)
      if (state.isSupported) {
        try {
          const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;

          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let newTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                newTranscript += event.results[i][0].transcript + ' ';
              }
            }
            
            if (newTranscript.trim()) {
              // Update both the ref and state
              currentTranscriptRef.current += newTranscript;
              setState(prev => ({ ...prev, transcript: prev.transcript + newTranscript }));
              onTranscriptUpdate?.(newTranscript);
            }
          };

          recognition.onerror = (event: any) => {
            console.warn('Speech recognition error (live transcript disabled):', event.error);
            // Don't call onError for speech recognition issues - recording still works
          };

          recognition.start();
        } catch (error) {
          console.warn('Speech recognition not available, continuing with audio recording only');
        }
      }

      // Start recording
      mediaRecorder.start();
      
      // Start duration counter
      let duration = 0;
      durationIntervalRef.current = setInterval(() => {
        duration += 1;
        setState(prev => ({ ...prev, duration }));
      }, 1000);

      // Reset transcript ref and state
      currentTranscriptRef.current = '';
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        transcript: ''
      }));

    } catch (error) {
      console.error('Error starting recording:', error);
      onError?.('Failed to start recording. Please check microphone permissions.');
    }
  }, [state.duration, state.isSupported, onTranscriptUpdate, onRecordingComplete, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  const resetRecording = useCallback(() => {
    currentTranscriptRef.current = '';
    setState(prev => ({ 
      ...prev, 
      duration: 0, 
      transcript: '',
      isRecording: false
    }));
    audioChunksRef.current = [];
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    toggleRecording,
    resetRecording
  };
}
