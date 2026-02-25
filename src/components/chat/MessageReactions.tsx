import { GroupedReaction } from "@/hooks/useReactions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageReactionsProps {
  reactions: GroupedReaction[];
  onToggle: (emoji: string) => void;
  isOwn: boolean;
}

export const MessageReactions = ({ reactions, onToggle, isOwn }: MessageReactionsProps) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
      <TooltipProvider delayDuration={200}>
        {reactions.map((r) => (
          <Tooltip key={r.emoji}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(r.emoji);
                }}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors border ${
                  r.hasReacted
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted/60 border-border text-foreground hover:bg-muted"
                }`}
              >
                <span className="text-sm">{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {r.users.map((u) => u.display_name).join(", ")}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
};
