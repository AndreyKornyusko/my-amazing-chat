import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceMessagePlayerProps {
  url: string;
  isMine: boolean;
}

const BAR_COUNT = 32;

export const VoiceMessagePlayer = ({ url, isMine }: VoiceMessagePlayerProps) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.85)
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number>(0);
  const canvasAnalyzed = useRef(false);

  // Generate waveform from actual audio data
  useEffect(() => {
    if (canvasAnalyzed.current) return;
    canvasAnalyzed.current = true;

    const analyzeAudio = async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        const samplesPerBar = Math.floor(rawData.length / BAR_COUNT);
        const newBars: number[] = [];

        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * samplesPerBar;
          for (let j = start; j < start + samplesPerBar && j < rawData.length; j++) {
            sum += Math.abs(rawData[j]);
          }
          newBars.push(sum / samplesPerBar);
        }

        // Normalize
        const max = Math.max(...newBars, 0.01);
        const normalized = newBars.map((v) => Math.max(0.08, v / max));
        setBars(normalized);
        await audioCtx.close();
      } catch {
        // Keep random bars on error
      }
    };

    analyzeAudio();
  }, [url]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.duration) {
      setProgress(audio.currentTime / audio.duration);
      setDuration(audio.duration);
    }
    if (!audio.paused) {
      animRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(0);
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      audio.pause();
      audio.src = "";
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      cancelAnimationFrame(animRef.current);
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      animRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    audio.currentTime = x * audio.duration;
    setProgress(x);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const playedBars = Math.floor(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-2 min-w-[180px] max-w-[260px]">
      <Button
        variant="ghost"
        size="icon"
        className={`h-10 w-10 rounded-full shrink-0 ${
          isMine
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-primary/10 hover:bg-primary/20 text-primary"
        }`}
        onClick={togglePlay}
      >
        {playing ? (
          <Pause className="h-5 w-5" fill="currentColor" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
        )}
      </Button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className="flex items-end gap-[2px] h-[28px] cursor-pointer"
          onClick={handleBarClick}
        >
          {bars.map((height, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-150"
              style={{
                height: `${Math.max(3, height * 28)}px`,
                backgroundColor:
                  i < playedBars
                    ? isMine
                      ? "hsl(var(--primary-foreground))"
                      : "hsl(var(--primary))"
                    : isMine
                      ? "hsl(var(--primary-foreground) / 0.35)"
                      : "hsl(var(--primary) / 0.3)",
              }}
            />
          ))}
        </div>
        <span
          className={`text-[11px] font-mono leading-none ${
            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {playing ? formatTime(audioRef.current?.currentTime ?? 0) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

