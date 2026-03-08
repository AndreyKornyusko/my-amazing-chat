import { useState, useRef, useCallback, useEffect } from "react";
import { Reply, Copy, Pencil, Trash2, Forward, Pin, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Message } from "@/hooks/useMessages";
import { GroupedReaction } from "@/hooks/useReactions";
import { useIsMobile } from "@/hooks/use-mobile";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

const QUICK_EMOJIS = ["👍", "😁", "❤️", "😢", "🔥", "🤣", "😱"];

interface MessageContextMenuProps {
  children: React.ReactNode;
  message: Message;
  isOwn: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReact: (emoji: string) => void;
}

export const MessageContextMenu = ({
  children,
  message,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onReact,
}: MessageContextMenuProps) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const isMobile = useIsMobile();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setShowPicker(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, closeMenu]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeMenu]);

  // Keep desktop menu inside viewport based on real rendered size
  useEffect(() => {
    if (!open || isMobile || !menuRef.current) return;

    const updatePosition = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const leftPadding = 8;
      const rightPadding = 40;
      const verticalPadding = 8;
      const maxX = Math.max(leftPadding, window.innerWidth - rect.width - rightPadding);
      const maxY = Math.max(verticalPadding, window.innerHeight - rect.height - verticalPadding);
      const nextX = Math.min(Math.max(position.x, leftPadding), maxX);
      const nextY = Math.min(Math.max(position.y, verticalPadding), maxY);

      setPosition((prev) => (prev.x === nextX && prev.y === nextY ? prev : { x: nextX, y: nextY }));
    };

    const rafId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, isMobile, position.x, position.y, showPicker]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (message.is_deleted) return;

    // Position relative to viewport
    const x = e.clientX;
    const y = e.clientY;
    setPosition({ x, y });
    setOpen(true);
    setShowPicker(false);
  }, [message.is_deleted]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (message.is_deleted) return;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setPosition({ x: touch.clientX, y: touch.clientY });
      setOpen(true);
      setShowPicker(false);
    }, 500);
  }, [message.is_deleted]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleAction = (action: () => void) => {
    action();
    closeMenu();
  };

  const handleQuickReact = (emoji: string) => {
    onReact(emoji);
    closeMenu();
  };

  const handleEmojiSelect = (emoji: any) => {
    onReact(emoji.native);
    closeMenu();
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    closeMenu();
  };

  const time = format(new Date(message.created_at), "d MMM yyyy 'at' HH:mm:ss");

  // Keep previously computed/clamped coordinates for desktop
  const menuStyle = isMobile ? {} : { left: position.x, top: position.y };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {children}

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" onClick={closeMenu} onTouchEnd={(e) => { e.preventDefault(); closeMenu(); }} />

          {/* Menu */}
          <div
            ref={menuRef}
            className={
              isMobile
                ? "fixed bottom-0 left-0 right-0 z-[60] flex justify-center animate-in slide-in-from-bottom-5 duration-200"
                : "fixed z-[60] animate-in fade-in-0 zoom-in-95 duration-150"
            }
            style={isMobile ? {} : menuStyle}
          >
            <div className={`${isMobile ? "rounded-t-2xl w-full max-w-[320px]" : "rounded-xl"} border border-border bg-popover shadow-2xl overflow-hidden`}>
              {/* Quick emoji bar */}
              {!showPicker && (
                <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleQuickReact(emoji)}
                      className="text-2xl hover:scale-125 active:scale-95 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowPicker(true)}
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-muted hover:bg-accent transition-colors"
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Emoji picker */}
              {showPicker && (
                <div className="max-h-[350px] overflow-hidden">
                  <Picker
                    data={data}
                    onEmojiSelect={handleEmojiSelect}
                    theme="auto"
                    previewPosition="none"
                    skinTonePosition="none"
                    perLine={isMobile ? 8 : 9}
                    maxFrequentRows={1}
                  />
                </div>
              )}

              {/* Actions */}
              {!showPicker && (
                <div className={`py-1 ${isMobile ? "pb-safe" : ""}`}>
                  <ContextMenuItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => handleAction(onReply)} />
                  <ContextMenuItem icon={<Copy className="h-4 w-4" />} label="Copy Text" onClick={handleCopy} />
                  {isOwn && (
                    <ContextMenuItem icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => handleAction(onEdit)} />
                  )}
                  <ContextMenuItem icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => handleAction(onForward)} />

                  {/* Timestamp */}
                  <div className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground">
                    <span className="text-xs">🕐</span>
                    <span className="text-xs">{time}</span>
                  </div>

                  {isOwn && (
                    <ContextMenuItem
                      icon={<Trash2 className="h-4 w-4" />}
                      label="Delete"
                      onClick={() => handleAction(onDelete)}
                      destructive
                    />
                  )}

                  {/* Safe area padding on mobile */}
                  {isMobile && <div className="h-4" />}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ContextMenuItem = ({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent ${
      destructive ? "text-destructive" : "text-popover-foreground"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
