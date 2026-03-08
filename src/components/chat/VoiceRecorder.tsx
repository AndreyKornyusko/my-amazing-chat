import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceRecorderProps {
  onSend: (blob: Blob, durationMs: number) => void;
}

export const VoiceRecorder = ({ onSend }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const durationMs = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0 && durationMs > 500) {
          onSend(blob, durationMs);
        }
        cleanup();
      };

      recorder.start(100);
      startTimeRef.current = Date.now();
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);
    } catch {
      cleanup();
    }
  }, [onSend, cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanup();
    };
  }, [cleanup]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!recording) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={startRecording}
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full shrink-0 text-destructive"
        onClick={cancelRecording}
      >
        <Trash2 className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 flex-1">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm font-mono text-muted-foreground">{formatTime(elapsed)}</span>
      </div>

      <Button
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={stopRecording}
      >
        <Square className="h-4 w-4" fill="currentColor" />
      </Button>
    </div>
  );
};
