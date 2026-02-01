import { useState, useCallback, useEffect, useRef } from "react";

// Speech Recognition API type declarations
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface UseVoiceInputOptions {
  language?: string;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
  isSupported: boolean;
  isRecording: boolean;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  clearError: () => void;
}

export function useVoiceInput({
  language = "en-US",
  onTranscript,
  onError,
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const lastResultIndexRef = useRef(0);

  // Update refs without triggering re-renders
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Initialize Speech Recognition once
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    // Handle start of recording
    recognition.onstart = () => {
      setIsRecording(true);
    };

    // Handle end of recording
    recognition.onend = () => {
      setIsRecording(false);
    };

    // Handle recognition results - minimal state updates
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      // Process only new results since last index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // Call callback with transcript (not via state update)
      if (finalTranscript.trim()) {
        onTranscriptRef.current?.(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        onTranscriptRef.current?.(interimTranscript, false);
      }

      lastResultIndexRef.current = event.resultIndex;
    };

    // Handle errors
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = "An error occurred during speech recognition";

      switch (event.error) {
        case "no-speech":
          errorMessage =
            "No speech detected. Please try again or speak louder.";
          break;
        case "audio-capture":
          errorMessage = "No microphone found. Please check your audio setup.";
          break;
        case "not-allowed":
          errorMessage =
            "Microphone permission denied. Please enable it in browser settings.";
          break;
        case "network":
          errorMessage =
            "Network error. Please check your internet connection.";
          break;
        case "aborted":
          return;
        default:
          errorMessage = `Error: ${event.error}`;
      }

      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    // Cleanup
    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, [language]);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    setError(null);
    lastResultIndexRef.current = 0;

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Already recording
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isSupported,
    isRecording,
    error,
    startRecording,
    stopRecording,
    clearError,
  };
}
