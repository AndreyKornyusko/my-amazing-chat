import { useState, useRef, useCallback } from "react";
import { GroupedReaction } from "@/hooks/useReactions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";

interface MessageReactionsProps {
  reactions: GroupedReaction[];
  onToggle: (emoji: string) => void;
  isOwn: boolean;
}

export const MessageReactions = ({ reactions, onToggle, isOwn }: MessageReactionsProps) => {
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (!reactions || reactions.length === 0) return null;

  const activeReaction = reactions.find((r) => r.emoji === activeEmoji);

  return (
    <>
      <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
        {reactions.map((r) => (
          <div
            key={r.emoji}
            className="relative"
            onMouseEnter={() => !isMobile && setActiveEmoji(r.emoji)}
            onMouseLeave={() => !isMobile && setActiveEmoji(null)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isMobile && activeEmoji === r.emoji) {
                  setActiveEmoji(null);
                  return;
                }
                onToggle(r.emoji);
              }}
              onTouchStart={() => {
                longPressTimer.current = setTimeout(() => {
                  setActiveEmoji(r.emoji);
                }, 400);
              }}
              onTouchEnd={() => clearLongPress()}
              onTouchMove={() => clearLongPress()}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors border ${
                r.hasReacted
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/60 border-border text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-sm">{r.emoji}</span>
              <span className="font-medium">{r.count}</span>
            </button>

            {/* Desktop tooltip popover */}
            {!isMobile && activeEmoji === r.emoji && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                <div className="bg-popover border border-border rounded-lg shadow-xl p-2 min-w-[160px] max-w-[220px]">
                  <div className="text-center text-lg mb-1">{r.emoji}</div>
                  <div className="space-y-1.5">
                    {r.users.map((u) => (
                      <div key={u.user_id} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {u.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-popover-foreground truncate">{u.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && activeReaction && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" onClick={() => setActiveEmoji(null)} />
          <div
            ref={popoverRef}
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="rounded-t-2xl border border-border bg-popover shadow-2xl overflow-hidden w-full max-w-[320px]">
              <div className="text-center text-2xl pt-3 pb-1">{activeReaction.emoji}</div>
              <div className="px-4 pb-4 space-y-2 max-h-[300px] overflow-y-auto">
                {activeReaction.users.map((u) => (
                  <div key={u.user_id} className="flex items-center gap-3 py-1.5">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {u.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-popover-foreground">{u.display_name}</span>
                  </div>
                ))}
              </div>
              <div className="h-4" />
            </div>
          </div>
        </>
      )}
    </>
  );
};
