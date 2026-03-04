import { useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaLightboxProps {
  url: string;
  onClose: () => void;
  forceVideo?: boolean;
}

export const MediaLightbox = ({ url, onClose, forceVideo }: MediaLightboxProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const isVideo = forceVideo || url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="absolute right-4 top-4 flex gap-2">
        <a href={url} download target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" size="icon"><Download className="h-5 w-5" /></Button>
        </a>
        <Button variant="secondary" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw]">
        {isVideo ? (
          <video src={url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        ) : (
          <img src={url} alt="media" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        )}
      </div>
    </div>
  );
};
