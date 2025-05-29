import React, { useState, useCallback, useRef } from 'react';

interface UseSpeechSynthesisProps {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface SpeechSynthesisState {
  isSupported: boolean;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
}

export function useSpeechSynthesis({
  voice,
  rate = 1,
  pitch = 1,
  volume = 1
}: UseSpeechSynthesisProps = {}) {
  const [state, setState] = useState<SpeechSynthesisState>({
    isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    isSpeaking: false,
    voices: []
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const loadVoices = useCallback(() => {
    if (state.isSupported) {
      const voices = speechSynthesis.getVoices();
      setState(prev => ({ ...prev, voices }));
    }
  }, [state.isSupported]);

  const speak = useCallback((text: string, options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: SpeechSynthesisErrorEvent) => void;
  }) => {
    if (!state.isSupported || !text) {
      console.warn('Speech synthesis not supported or no text provided');
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    utterance.voice = voice || null;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => {
      setState(prev => ({ ...prev, isSpeaking: true }));
      options?.onStart?.();
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      options?.onEnd?.();
    };

    utterance.onerror = (event) => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      console.error('Speech synthesis error:', event);
      options?.onError?.(event);
    };

    speechSynthesis.speak(utterance);
  }, [state.isSupported, voice, rate, pitch, volume]);

  const stop = useCallback(() => {
    if (state.isSupported) {
      speechSynthesis.cancel();
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, [state.isSupported]);

  const pause = useCallback(() => {
    if (state.isSupported && state.isSpeaking) {
      speechSynthesis.pause();
    }
  }, [state.isSupported, state.isSpeaking]);

  const resume = useCallback(() => {
    if (state.isSupported) {
      speechSynthesis.resume();
    }
  }, [state.isSupported]);

  // Load voices on mount and when voices change
  React.useEffect(() => {
    if (state.isSupported) {
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => {
      if (state.isSupported) {
        speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [state.isSupported, loadVoices]);

  return {
    state,
    speak,
    stop,
    pause,
    resume,
    loadVoices
  };
}
