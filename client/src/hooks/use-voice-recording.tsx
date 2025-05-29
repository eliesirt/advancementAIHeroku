import { useState, useRef, useCallback } from 'react';

interface UseVoiceRecordingProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onRecordingComplete?: (audioData: string, duration: number) => void;
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
          onRecordingComplete?.(base64Audio, state.duration);
        };
        reader.readAsDataURL(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      // Set up Speech Recognition
      if (state.isSupported) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript + ' ';
            }
          }
          
          setState(prev => ({ ...prev, transcript: prev.transcript + transcript }));
          onTranscriptUpdate?.(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          onError?.(`Speech recognition error: ${event.error}`);
        };

        recognition.start();
      }

      // Start recording
      mediaRecorder.start();
      
      // Start duration counter
      let duration = 0;
      durationIntervalRef.current = setInterval(() => {
        duration += 1;
        setState(prev => ({ ...prev, duration }));
      }, 1000);

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
