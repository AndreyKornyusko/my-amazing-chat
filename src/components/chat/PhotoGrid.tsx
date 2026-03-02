import { cn } from "@/lib/utils";

interface PhotoGridProps {
  photos: { url: string; name?: string }[];
  onPhotoClick: (index: number) => void;
}

/**
 * Telegram-style photo grid layout for 1-7 photos.
 */
export const PhotoGrid = ({ photos, onPhotoClick }: PhotoGridProps) => {
  const count = photos.length;

  if (count === 1) {
    return (
      <div className="cursor-pointer overflow-hidden rounded-lg" onClick={() => onPhotoClick(0)}>
        <img
          src={photos[0].url}
          alt={photos[0].name || "photo"}
          className="max-h-72 w-full object-cover transition-transform hover:scale-105"
          loading="lazy"
        />
      </div>
    );
  }

  // For 2+ photos, use a grid
  return (
    <div className={cn("grid gap-0.5 overflow-hidden rounded-lg", getGridClass(count))}>
      {photos.map((photo, i) => (
        <div
          key={i}
          className={cn(
            "relative cursor-pointer overflow-hidden bg-muted",
            getItemClass(count, i)
          )}
          onClick={() => onPhotoClick(i)}
        >
          <img
            src={photo.url}
            alt={photo.name || "photo"}
            className="h-full w-full object-cover transition-transform hover:scale-105"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};

function getGridClass(count: number): string {
  switch (count) {
    case 2: return "grid-cols-2 aspect-[2/1]";
    case 3: return "grid-cols-3 grid-rows-2 aspect-[3/2]";
    case 4: return "grid-cols-2 grid-rows-2 aspect-square";
    case 5: return "grid-cols-6 grid-rows-2 aspect-[3/2]";
    case 6: return "grid-cols-3 grid-rows-2 aspect-[3/2]";
    case 7: return "grid-cols-6 grid-rows-3 aspect-[3/2.5]";
    default: return "grid-cols-2 grid-rows-2 aspect-square";
  }
}

function getItemClass(count: number, index: number): string {
  if (count === 3) {
    if (index === 0) return "row-span-2 col-span-2";
    return "col-span-1";
  }
  if (count === 5) {
    if (index < 2) return "col-span-3";
    return "col-span-2";
  }
  if (count === 7) {
    if (index === 0) return "col-span-3 row-span-2";
    if (index < 4) return "col-span-1";
    return "col-span-2";
  }
  return "";
}
