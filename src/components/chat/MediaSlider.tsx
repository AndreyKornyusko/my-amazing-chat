import { useState, useEffect, useCallback } from "react";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaSliderProps {
  photos: { url: string; name?: string }[];
  initialIndex: number;
  onClose: () => void;
}

export const MediaSlider = ({ photos, initialIndex, onClose }: MediaSliderProps) => {
  const [current, setCurrent] = useState(initialIndex);

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, photos.length - 1)), [photos.length]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  const photo = photos[current];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" onClick={onClose}>
      {/* Top bar */}
      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
        <span className="text-white/70 text-sm mr-2">
          {current + 1} / {photos.length}
        </span>
        <a href={photo.url} download target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" size="icon"><Download className="h-5 w-5" /></Button>
        </a>
        <Button variant="secondary" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>

      {/* Navigation arrows */}
      {current > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {current < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw]">
        <img
          src={photo.url}
          alt={photo.name || "photo"}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        />
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-12 w-12 overflow-hidden rounded-md border-2 transition ${i === current ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
