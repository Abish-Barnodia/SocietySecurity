import { useCallback, useRef, useState } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

export type RecordedVoiceNote = { uri: string; durationSec: number };

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();

    setElapsedSec(0);
    setIsRecording(true);
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }, [recorder]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = useCallback(async (): Promise<RecordedVoiceNote | null> => {
    clearTimer();
    setIsRecording(false);
    await recorder.stop();
    if (!recorder.uri) return null;
    return { uri: recorder.uri, durationSec: Math.max(1, Math.round(recorder.currentTime)) };
  }, [recorder]);

  const cancelRecording = useCallback(async () => {
    clearTimer();
    setIsRecording(false);
    try {
      await recorder.stop();
    } catch {
      // Already stopped/never started — nothing to clean up.
    }
  }, [recorder]);

  return { isRecording, elapsedSec, startRecording, stopRecording, cancelRecording };
}
