import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useMarkAsRead, useUnreadMessageIds, Message } from "@/hooks/useMessages";
import { useReactions, useToggleReaction, GroupedReaction } from "@/hooks/useReactions";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowDown, Send, Paperclip, X, Check, CheckCheck, Pencil, Reply, Search, Play, Loader2, AlertCircle, RotateCcw, Trash2, Smile, Mic, MoreVertical, Info, BellOff, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { VoiceRecorder } from "./VoiceRecorder";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { format, isToday, isYesterday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ForwardDialog } from "./ForwardDialog";
import { MediaLightbox } from "./MediaLightbox";
import { MediaSlider } from "./MediaSlider";
import { PhotoGrid } from "./PhotoGrid";
import { MessageContextMenu } from "./MessageContextMenu";
import { MessageReactions } from "./MessageReactions";
import { UserProfileDialog } from "./UserProfileDialog";
import ChatBackgroundPattern from "./ChatBackgroundPattern";
import { GroupMembersDialog } from "./GroupMembersDialog";

interface ChatWindowProps {
  conversationId: string | null;
  onBack?: () => void;
}

export const ChatWindow = ({ conversationId, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const { messages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(conversationId);
  const unreadIds = useUnreadMessageIds(conversationId);
  const reactionsMap = useReactions(conversationId);
  const toggleReaction = useToggleReaction();
  const { data: conversations } = useConversations();
  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const markAsRead = useMarkAsRead();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIsVideo, setLightboxIsVideo] = useState(false);
  const [sliderPhotos, setSliderPhotos] = useState<{ url: string; name?: string }[] | null>(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false);
  const [leaveGroupConfirm, setLeaveGroupConfirm] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const unreadSeparatorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const initialScrollDone = useRef(false);
  const readBatchRef = useRef<Set<string>>(new Set());
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markAsReadRef = useRef(markAsRead);
  markAsReadRef.current = markAsRead;
  const unreadIdsRef = useRef(unreadIds);
  unreadIdsRef.current = unreadIds;
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const conversation = conversations?.find((c) => c.id === conversationId);

  // Compute first unread message ID for the separator
  const firstUnreadId = useMemo(() => {
    if (!messages || !user) return null;
    for (const msg of messages) {
      if (msg.sender_id !== user.id && unreadIds.has(msg.id)) {
        return msg.id;
      }
    }
    return null;
  }, [messages, user, unreadIds]);

  const unreadCount = unreadIds.size;

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  // Initial scroll: to unread separator or bottom
  useEffect(() => {
    if (!messages || messages.length === 0 || initialScrollDone.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (unreadSeparatorRef.current) {
        unreadSeparatorRef.current.scrollIntoView({ block: "center" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
      initialScrollDone.current = true;
    });
  }, [messages, firstUnreadId]);

  useEffect(() => { initialScrollDone.current = false; }, [conversationId]);

  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (!messages) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    if (messages.length > prevMsgCountRef.current && isAtBottom && initialScrollDone.current) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, isAtBottom]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          prevScrollHeightRef.current = container.scrollHeight;
          fetchNextPage();
        }
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Preserve scroll position after loading older messages
  useEffect(() => {
    if (!isFetchingNextPage && prevScrollHeightRef.current > 0) {
      const container = scrollContainerRef.current;
      if (container) {
        const diff = container.scrollHeight - prevScrollHeightRef.current;
        container.scrollTop += diff;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [isFetchingNextPage]);

  // Read-on-scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !user || !conversationId) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const msgId = (entry.target as HTMLElement).dataset.msgId;
            if (msgId && unreadIdsRef.current.has(msgId)) {
              readBatchRef.current.add(msgId);
              if (readTimerRef.current) clearTimeout(readTimerRef.current);
              readTimerRef.current = setTimeout(() => {
                const ids = Array.from(readBatchRef.current);
                if (ids.length > 0 && conversationIdRef.current) {
                  markAsReadRef.current.mutate({ messageIds: ids, conversationId: conversationIdRef.current });
                  readBatchRef.current.clear();
                }
              }, 500);
            }
          }
        }
      },
      { root: container, threshold: 0.5 }
    );
    const elements = container.querySelectorAll("[data-unread='true']");
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [messages, unreadIds, user, conversationId]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    if (unreadIds.size > 0 && conversationId) {
      markAsRead.mutate({ messageIds: Array.from(unreadIds), conversationId });
    }
  }, [unreadIds, conversationId, markAsRead]);
  // Close emoji picker on outside click (desktop)
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  const handleSend = async () => {
    if (!conversationId || !text.trim()) return;
    if (editingMsg) {
      editMessage.mutate({ id: editingMsg.id, content: text, conversationId });
      setEditingMsg(null);
      setText("");
      return;
    }
    const tempId = `temp-${crypto.randomUUID()}`;
    sendMessage.mutate({
      conversation_id: conversationId,
      content: text,
      reply_to_id: replyTo?.id,
      _tempId: tempId,
    });
    setText("");
    setReplyTo(null);
    // Scroll to bottom after sending
    setTimeout(() => scrollToBottom(), 50);
  };

  const handleRetryMessage = (msg: Message) => {
    if (!conversationId) return;
    // Remove the failed optimistic message from cache first
    const queryKey = ["messages", conversationId];
    qc.setQueryData(queryKey, (old: any) => {
      if (!old?.pages) return old;
      return { ...old, pages: old.pages.map((page: Message[]) => page.filter((m: any) => m.id !== msg.id)) };
    });
    // Re-send
    sendMessage.mutate({
      conversation_id: conversationId,
      content: msg.content || "",
      reply_to_id: msg.reply_to_id || undefined,
      _tempId: `temp-${crypto.randomUUID()}`,
    });
  };

  const handleCancelMessage = (msgId: string) => {
    if (!conversationId) return;
    const queryKey = ["messages", conversationId];
    qc.setQueryData(queryKey, (old: any) => {
      if (!old?.pages) return old;
      return { ...old, pages: old.pages.map((page: Message[]) => page.filter((m: any) => m.id !== msgId)) };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !conversationId || !user) return;

    const fileList = Array.from(files).slice(0, 7);
    if (files.length > 7) {
      toast({ title: "Limit exceeded", description: "You can upload up to 7 photos at once", variant: "destructive" });
    }

    for (const file of fileList) {
      const ext = file.name.split(".").pop();
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-media").upload(path, file);
      if (error) {
        toast({ title: "Upload error", description: `${file.name}: ${error.message}`, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      sendMessage.mutate({
        conversation_id: conversationId,
        content: file.name,
        type: isImage ? "photo" : isVideo ? "video" : "file",
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });
    }
    e.target.value = "";
  };

  const handleVoiceSend = async (blob: Blob, durationMs: number) => {
    if (!conversationId || !user) return;
    const ext = blob.type.includes("webm") ? "webm" : "ogg";
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: blob.type });
    if (error) {
      toast({ title: "Upload error", description: error.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    sendMessage.mutate({
      conversation_id: conversationId,
      content: `Voice message (${Math.ceil(durationMs / 1000)}s)`,
      type: "voice",
      file_url: urlData.publicUrl,
      file_name: `voice.${ext}`,
      file_size: blob.size,
    });
    setTimeout(() => scrollToBottom(), 50);
  };

  const handleEditGroupName = async () => {
    if (!conversationId || !editGroupName.trim()) return;
    const { error } = await supabase.from("conversations").update({ name: editGroupName.trim() }).eq("id", conversationId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setEditGroupOpen(false);
    toast({ title: "Group name updated" });
  };

  const handleClearHistory = async () => {
    if (!conversationId) return;
    const { error } = await supabase.from("messages").update({ is_deleted: true, content: null }).eq("conversation_id", conversationId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    setClearHistoryConfirm(false);
    toast({ title: "Chat history cleared" });
  };

  const handleLeaveGroup = async () => {
    if (!conversationId || !user) return;
    const { error } = await supabase.from("conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", user.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setLeaveGroupConfirm(false);
    onBack?.();
    toast({ title: "You left the group" });
  };

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    if (!searchQuery) return messages;
    return messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    if (!conversationId) return;
    toggleReaction.mutate({ messageId, emoji, conversationId });
  }, [conversationId, toggleReaction]);

  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [jumpToMsgId, setJumpToMsgId] = useState<string | null>(null);

  // After messages update, check if the jump target is now in the DOM
  useEffect(() => {
    if (!jumpToMsgId) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    // Use requestAnimationFrame to wait for DOM update
    const raf = requestAnimationFrame(() => {
      const el = container.querySelector(`[data-msg-id="${jumpToMsgId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center" });
        setHighlightedMsgId(jumpToMsgId);
        setTimeout(() => setHighlightedMsgId(null), 2000);
        setJumpToMsgId(null);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [jumpToMsgId, messages]);

  const scrollToMessage = useCallback(async (messageId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // If already in DOM, jump instantly
    const el = container.querySelector(`[data-msg-id="${messageId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center" });
      setHighlightedMsgId(messageId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
      return;
    }

    // Message not loaded — keep fetching older pages until found or no more pages
    setJumpToMsgId(messageId);

    // Fetch pages in a loop until the message appears or we run out
    const fetchLoop = async () => {
      // We need to access the query data to check pages
      let attempts = 0;
      const maxAttempts = 20; // safety limit
      while (attempts < maxAttempts) {
        const queryData: any = qc.getQueryData(["messages", conversationId]);
        // Check if message is already in the data
        const found = queryData?.pages?.some((page: Message[]) =>
          page.some((m: Message) => m.id === messageId)
        );
        if (found) break;

        // Check if there are more pages
        const hasMore = queryData?.pages
          ? queryData.pages[queryData.pages.length - 1]?.length === 30
          : false;
        if (!hasMore) break;

        await fetchNextPage();
        attempts++;
        // Small delay to let state settle
        await new Promise((r) => setTimeout(r, 100));
      }
    };

    fetchLoop();
  }, [conversationId, fetchNextPage, qc]);

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Select a chat to start messaging</p>
      </div>
    );
  }

  const chatName = conversation ? getConvName(conversation, user?.id ?? "") : "Chat";
  const chatAvatar = conversation ? getConvAvatar(conversation, user?.id ?? "") : null;
  const otherUser = conversation?.type === "private" ? conversation.members.find((m) => m.user_id !== user?.id) : null;

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden pt-[60px] md:pt-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 fixed top-0 left-0 right-0 z-40 bg-background md:relative md:top-auto md:left-auto md:right-auto md:z-auto">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10 cursor-pointer" onClick={() => {
          if (conversation?.type === "private" && otherUser) {
            setProfileUserId(otherUser.user_id);
          }
        }}>
          <AvatarImage src={chatAvatar ?? undefined} />
          <AvatarFallback>{chatName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2
            className="font-semibold cursor-pointer hover:underline truncate"
            onClick={() => {
              if (conversation?.type === "private" && otherUser) {
                setProfileUserId(otherUser.user_id);
              }
            }}
          >{chatName}</h2>
          {conversation?.type === "group" ? (
            <p
              className="text-xs text-muted-foreground cursor-pointer hover:underline"
              onClick={() => setMembersDialogOpen(true)}
            >
              {conversation.members.length} members
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {otherUser?.profile?.is_online ? "online" : "offline"}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); }}>
          <Search className="h-5 w-5" />
        </Button>
        {conversation?.type === "group" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => { setEditGroupName(conversation.name || ""); setEditGroupOpen(true); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (conversation.members.length > 0) {
                  setProfileUserId(conversation.members[0].user_id);
                }
              }}>
                <Info className="h-4 w-4 mr-2" />
                Info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "Notifications muted" })}>
                <BellOff className="h-4 w-4 mr-2" />
                Mute
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setClearHistoryConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setLeaveGroupConfirm(true)}>
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {searchOpen && (
        <div className="border-b border-border px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" autoFocus />
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="relative flex-1 overflow-hidden md:bg-transparent bg-gradient-to-br from-[hsl(var(--chat-gradient-from))] via-[hsl(var(--chat-gradient-via))] to-[hsl(var(--chat-gradient-to))]">
        <div className="md:hidden">
          <ChatBackgroundPattern />
        </div>
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-4 py-2 md:pb-2 pb-20"
          onScroll={handleScroll}
        >
          {hasNextPage && <div ref={topSentinelRef} className="h-1" />}
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {isLoading && <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>}

          {(() => {
            // Group consecutive photo messages from same sender within 10s
            const groups: { msgs: typeof filteredMessages; isPhotoGroup: boolean }[] = [];
            for (let i = 0; i < filteredMessages.length; i++) {
              const msg = filteredMessages[i];
              const lastGroup = groups[groups.length - 1];
              if (
                lastGroup?.isPhotoGroup &&
                msg.type === "photo" &&
                msg.file_url &&
                msg.sender_id === lastGroup.msgs[0].sender_id &&
                Math.abs(new Date(msg.created_at).getTime() - new Date(lastGroup.msgs[lastGroup.msgs.length - 1].created_at).getTime()) < 10000
              ) {
                lastGroup.msgs.push(msg);
              } else {
                const isPhoto = msg.type === "photo" && !!msg.file_url;
                groups.push({ msgs: [msg], isPhotoGroup: isPhoto });
              }
            }

            return groups.map((group) => {
              if (group.isPhotoGroup && group.msgs.length > 1) {
                // Render as photo grid
                const firstMsg = group.msgs[0];
                const lastMsg = group.msgs[group.msgs.length - 1];
                const isOwn = firstMsg.sender_id === user?.id;
                const prev = filteredMessages[filteredMessages.indexOf(firstMsg) - 1];
                const showDate = !prev || !isSameDay(new Date(prev.created_at), new Date(firstMsg.created_at));
                const showUnreadSep = group.msgs.some(m => m.id === firstUnreadId);
                const photos = group.msgs.map(m => ({ url: m.file_url!, name: m.file_name || undefined }));
                const time = format(new Date(lastMsg.created_at), "HH:mm");

                const hasUnread = group.msgs.some(m => user && m.sender_id !== user.id && unreadIds.has(m.id));
                return (
                  <div key={firstMsg.id} data-msg-id={firstMsg.id} data-unread={hasUnread ? "true" : "false"}>
                    {showDate && <DateSeparator date={new Date(firstMsg.created_at)} />}
                    {showUnreadSep && (
                      <div ref={unreadSeparatorRef} className="my-3 flex justify-center">
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary font-medium">Unread messages</span>
                      </div>
                    )}
                    <div className={`mb-1 flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      {conversation?.type === "group" && !isOwn && (
                        <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0 cursor-pointer" onClick={() => setProfileUserId(firstMsg.sender_id)}>
                          <AvatarImage src={firstMsg.sender_profile?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{firstMsg.sender_profile?.display_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="max-w-[75%]">
                        <MessageContextMenu
                          message={firstMsg}
                          isOwn={isOwn}
                          onReply={() => setReplyTo(firstMsg)}
                          onEdit={() => {}}
                          onDelete={() => group.msgs.forEach(m => deleteMessage.mutate({ id: m.id, conversationId: conversationId! }))}
                          onForward={() => setForwardMsg(firstMsg)}
                          onReact={(emoji) => handleReact(firstMsg.id, emoji)}
                        >
                          <div className={`relative rounded-2xl px-1 py-1 ${isOwn ? "bg-chat-bubble-out text-chat-bubble-out-foreground rounded-br-md" : "bg-chat-bubble-in text-chat-bubble-in-foreground rounded-bl-md"}`}>
                            {conversation?.type === "group" && !isOwn && (
                              <p className="mb-0.5 px-2 text-xs font-semibold text-primary cursor-pointer hover:underline truncate max-w-[200px]"
                                 onClick={() => setProfileUserId(firstMsg.sender_id)}>
                                {firstMsg.sender_profile?.display_name}
                              </p>
                            )}
                            <PhotoGrid
                              photos={photos}
                              onPhotoClick={(idx) => { setSliderPhotos(photos); setSliderIndex(idx); }}
                            />
                            <div className={`mt-0.5 px-2 flex items-center justify-end gap-1 text-[10px] ${isOwn ? "text-chat-bubble-out-foreground/50" : "text-chat-bubble-in-foreground/50"}`}>
                              <span>{photos.length} photos</span>
                              <span>{time}</span>
                              {isOwn && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </MessageContextMenu>
                      </div>
                    </div>
                  </div>
                );
              }

              // Render individual messages normally
              return group.msgs.map((msg) => {
                const idx = filteredMessages.indexOf(msg);
                const prev = filteredMessages[idx - 1];
                const showDate = !prev || !isSameDay(new Date(prev.created_at), new Date(msg.created_at));
                const showUnreadSeparator = msg.id === firstUnreadId;
                const isUnread = user && msg.sender_id !== user.id && unreadIds.has(msg.id);

                return (
                  <div key={msg.id} data-msg-id={msg.id} data-unread={isUnread ? "true" : "false"} className={`transition-colors duration-700 ${highlightedMsgId === msg.id ? "bg-primary/15 rounded-lg" : ""}`}>
                    {showDate && <DateSeparator date={new Date(msg.created_at)} />}
                    {showUnreadSeparator && (
                      <div ref={unreadSeparatorRef} className="my-3 flex justify-center">
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary font-medium">Unread messages</span>
                      </div>
                    )}
                    <MessageBubble
                      message={msg}
                      isOwn={msg.sender_id === user?.id}
                      isGroup={conversation?.type === "group"}
                      onReply={() => setReplyTo(msg)}
                      onEdit={() => { setEditingMsg(msg); setText(msg.content ?? ""); }}
                      onDelete={() => deleteMessage.mutate({ id: msg.id, conversationId: conversationId! })}
                      onForward={() => setForwardMsg(msg)}
                      onMediaClick={(url, isVideo) => { setLightboxUrl(url); setLightboxIsVideo(!!isVideo); }}
                      onReact={(emoji) => handleReact(msg.id, emoji)}
                      reactions={reactionsMap[msg.id] ?? []}
                      searchQuery={searchQuery}
                      onProfileClick={(uid) => setProfileUserId(uid)}
                      onRetry={msg._optimistic && msg._status === "failed" ? () => handleRetryMessage(msg) : undefined}
                      onCancel={msg._optimistic && msg._status === "failed" ? () => handleCancelMessage(msg.id) : undefined}
                      onScrollToReply={scrollToMessage}
                    />
                  </div>
                );
              });
            });
          })()}

        </div>

        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 md:bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border shadow-lg transition-transform hover:scale-105 active:scale-95 z-10"
          >
            <ArrowDown className="h-5 w-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Reply / Edit bar */}
      {(replyTo || editingMsg) && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-2 md:relative fixed bottom-14 left-0 right-0 z-40 md:bottom-auto md:left-auto md:right-auto md:z-auto">
          <div className="flex-1 truncate text-sm">
            {editingMsg ? (
              <span className="text-primary"><Pencil className="mr-1 inline h-3 w-3" />Editing</span>
            ) : (
              <span className="text-primary"><Reply className="mr-1 inline h-3 w-3" />{replyTo?.sender_profile?.display_name}: {replyTo?.content?.slice(0, 50)}</span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setReplyTo(null); setEditingMsg(null); setText(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input - floating on mobile */}
      <div className="flex items-center gap-2 px-3 py-2 md:border-t md:border-border md:bg-background md:px-4 md:py-3 md:relative fixed bottom-0 left-0 right-0 z-40 md:bottom-auto md:left-auto md:right-auto md:z-auto">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} multiple accept="image/*,video/*,application/*" />
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full md:rounded-md shrink-0" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="h-5 w-5" />
        </Button>
        <Input
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          className="flex-1 md:rounded-md rounded-full bg-card/90 md:bg-background backdrop-blur-sm md:backdrop-blur-none border-border/50"
        />

        {/* Emoji button: always on desktop, only when typing on mobile */}
        <div className={`relative ${!text.trim() ? "hidden md:block" : ""}`} ref={emojiPickerRef}>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full md:rounded-md shrink-0" onClick={() => setShowEmojiPicker((v) => !v)}>
            <Smile className="h-5 w-5" />
          </Button>
          {showEmojiPicker && (
            <>
              <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] md:hidden" onClick={() => setShowEmojiPicker(false)} />
              <div className="absolute bottom-12 right-0 z-50 md:block hidden">
                <Picker data={data} onEmojiSelect={(e: any) => { setText((t) => t + e.native); setShowEmojiPicker(false); }} theme="auto" previewPosition="none" skinTonePosition="none" />
              </div>
              <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center animate-in slide-in-from-bottom-5 duration-200 md:hidden">
                <div className="rounded-t-2xl border border-border bg-popover shadow-2xl overflow-hidden w-full max-w-[360px]">
                  <Picker data={data} onEmojiSelect={(e: any) => { setText((t) => t + e.native); setShowEmojiPicker(false); }} theme="auto" previewPosition="none" skinTonePosition="none" perLine={8} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Send button when typing, Mic button when empty (mobile only swaps) */}
        {text.trim() ? (
          <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <>
            {/* Desktop: always show send (disabled) */}
            <div className="hidden md:block">
              <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={handleSend} disabled>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {/* Mobile: show voice recorder */}
            <div className="md:hidden">
              <VoiceRecorder onSend={handleVoiceSend} />
            </div>
          </>
        )}
      </div>

      {forwardMsg && (
        <ForwardDialog message={forwardMsg} open={!!forwardMsg} onOpenChange={() => setForwardMsg(null)} />
      )}
      {lightboxUrl && <MediaLightbox url={lightboxUrl} onClose={() => { setLightboxUrl(null); setLightboxIsVideo(false); }} forceVideo={lightboxIsVideo} />}
      {sliderPhotos && (
        <MediaSlider
          photos={sliderPhotos}
          initialIndex={sliderIndex}
          onClose={() => setSliderPhotos(null)}
        />
      )}
      {profileUserId && (
        <UserProfileDialog
          open={!!profileUserId}
          onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
          userId={profileUserId}
        />
      )}

      {conversation?.type === "group" && (
        <GroupMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          members={conversation.members}
          groupName={chatName}
          onMemberClick={(userId) => setProfileUserId(userId)}
        />
      )}

      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Group Name</DialogTitle>
          </DialogHeader>
          <Input
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
            placeholder="Group name"
            onKeyDown={(e) => e.key === "Enter" && handleEditGroupName()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleEditGroupName} disabled={!editGroupName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear History Confirm */}
      <AlertDialog open={clearHistoryConfirm} onOpenChange={setClearHistoryConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all messages in this chat. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Group Confirm */}
      <AlertDialog open={leaveGroupConfirm} onOpenChange={setLeaveGroupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group? You won't be able to see messages anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// --- Sub-components ---

const DateSeparator = ({ date }: { date: Date }) => {
  const label = isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMM d, yyyy");
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{label}</span>
    </div>
  );
};

const MessageBubble = ({
  message: msg,
  isOwn,
  isGroup,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onMediaClick,
  onReact,
  reactions,
  searchQuery,
  onProfileClick,
  onRetry,
  onCancel,
  onScrollToReply,
}: {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onMediaClick: (url: string, isVideo?: boolean) => void;
  onReact: (emoji: string) => void;
  reactions: GroupedReaction[];
  searchQuery: string;
  onProfileClick?: (userId: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
  onScrollToReply?: (messageId: string) => void;
}) => {
  if (msg.is_deleted) {
    return (
      <div className={`mb-1 flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <div className="rounded-xl bg-muted px-3 py-2 text-sm italic text-muted-foreground">Message deleted</div>
      </div>
    );
  }

  const time = format(new Date(msg.created_at), "HH:mm");
  const readCount = (msg.read_by ?? []).length;
  const hasReads = readCount > 0;

  // Detect emoji-only messages (1-3 emojis, no other text)
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,3}$/u;
  const isEmojiOnly = msg.type === "text" && msg.content && emojiRegex.test(msg.content.trim()) && !msg.reply_to && !msg.forwarded_from_id;
  const emojiCount = isEmojiOnly ? [...msg.content!.trim()].filter(c => /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(c)).length : 0;
  const emojiSize = emojiCount === 1 ? "text-6xl" : emojiCount === 2 ? "text-5xl" : "text-4xl";

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === searchQuery.toLowerCase() ? <mark key={i} className="bg-primary/30 rounded px-0.5">{p}</mark> : p
    );
  };

  return (
    <div className={`mb-1 flex ${isOwn ? "justify-end" : "justify-start"}`}>
      {isGroup && !isOwn && (
        <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0 cursor-pointer" onClick={() => onProfileClick?.(msg.sender_id)}>
          <AvatarImage src={msg.sender_profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{msg.sender_profile?.display_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div className="max-w-[75%]">
        <MessageContextMenu
          message={msg}
          isOwn={isOwn}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onForward={onForward}
          onReact={onReact}
        >
          {isEmojiOnly ? (
            <div className="relative px-1 py-1">
              {isGroup && !isOwn && (
                <p className="mb-0.5 text-xs font-semibold text-primary cursor-pointer hover:underline truncate max-w-[200px]"
                   onClick={() => onProfileClick?.(msg.sender_id)}>
                  {msg.sender_profile?.display_name}
                </p>
              )}
              <p className={`${emojiSize} leading-tight`}>{msg.content}</p>
              <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground`}>
                {msg.is_edited && <span>edited</span>}
                <span>{time}</span>
                {isOwn && (
                  msg._optimistic && msg._status === "sending"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : msg._optimistic && msg._status === "failed"
                    ? <AlertCircle className="h-3 w-3 text-destructive" />
                    : hasReads ? <CheckCheck className="h-3 w-3 text-read" /> : <Check className="h-3 w-3" />
                )}
              </div>
            </div>
          ) : (
          <div className={`relative rounded-2xl px-3 py-2 ${isOwn ? "bg-chat-bubble-out text-chat-bubble-out-foreground rounded-br-md" : "bg-chat-bubble-in text-chat-bubble-in-foreground rounded-bl-md"}`}>
            {isGroup && !isOwn && (
              <p
                className="mb-0.5 text-xs font-semibold text-primary cursor-pointer hover:underline truncate max-w-[200px]"
                onClick={() => onProfileClick?.(msg.sender_id)}
              >{msg.sender_profile?.display_name}</p>
            )}

            {msg.reply_to && (
              <div
                className="mb-1 rounded border-l-2 border-primary bg-muted/50 px-2 py-1 text-xs cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => msg.reply_to_id && onScrollToReply?.(msg.reply_to_id)}
              >
                {msg.reply_to.content?.slice(0, 60)}
              </div>
            )}

            {msg.forwarded_from_id && (
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="text-sm">↗</span>
                <span>Forwarded from </span>
                <span
                  className="font-semibold text-primary cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (msg.forwarded_from_profile?.sender_id) {
                      onProfileClick?.(msg.forwarded_from_profile.sender_id);
                    }
                  }}
                >
                  {msg.forwarded_from_profile?.display_name || "Unknown"}
                </span>
              </div>
            )}

            {(msg.type === "photo" && msg.file_url) && (
              <div className="mb-1 cursor-pointer overflow-hidden rounded-lg" onClick={() => onMediaClick(msg.file_url!)}>
                <img src={msg.file_url} alt={msg.file_name || "photo"} className="max-h-60 w-full object-cover transition-transform hover:scale-105" loading="lazy" />
              </div>
            )}

            {(msg.type === "video" && msg.file_url) && (
              <div className="relative mb-1 cursor-pointer overflow-hidden rounded-2xl bg-black min-h-[200px] max-w-[280px]" onClick={() => onMediaClick(msg.file_url!, true)}>
                <video src={`${msg.file_url}#t=0.1`} className="min-h-[200px] max-h-80 w-full object-cover" preload="metadata" muted playsInline />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-md">
                    <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                  </div>
                </div>
              </div>
            )}

            {(msg.type === "file" && msg.file_url) && (
              <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded bg-muted/50 p-2 text-sm hover:bg-muted">
                📎 {msg.file_name || "File"}
              </a>
            )}

            {(msg.type === "voice" && msg.file_url) && (
              <VoiceMessagePlayer url={msg.file_url} isMine={isOwn} />
            )}

            {msg.content && msg.type === "text" && (
              <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{highlightText(msg.content)}</p>
            )}

            <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isOwn ? "text-chat-bubble-out-foreground/50" : "text-chat-bubble-in-foreground/50"}`}>
              {msg.is_edited && <span>edited</span>}
              <span>{time}</span>
              {isOwn && (
                msg._optimistic && msg._status === "sending"
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : msg._optimistic && msg._status === "failed"
                  ? <AlertCircle className="h-3 w-3 text-destructive" />
                  : hasReads ? <CheckCheck className="h-3 w-3 text-read" /> : <Check className="h-3 w-3" />
              )}
            </div>
          </div>
          )}
        </MessageContextMenu>

        {/* Failed message actions */}
        {msg._optimistic && msg._status === "failed" && (
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[11px] text-destructive mr-1">Not sent</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary" onClick={onRetry}>
              <RotateCcw className="h-3 w-3" />Retry
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={onCancel}>
              <Trash2 className="h-3 w-3" />Cancel
            </Button>
          </div>
        )}

        {/* Reactions display */}
        <MessageReactions
          reactions={reactions}
          onToggle={(emoji) => onReact(emoji)}
          isOwn={isOwn}
        />
      </div>
    </div>
  );
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getConvName(conv: ConversationWithDetails, uid: string) {
  if (conv.type === "group") return conv.name || "Group";
  const other = conv.members.find((m) => m.user_id !== uid);
  return other?.profile?.display_name || "Chat";
}

function getConvAvatar(conv: ConversationWithDetails, uid: string) {
  if (conv.type === "group") return conv.avatar_url;
  const other = conv.members.find((m) => m.user_id !== uid);
  return other?.profile?.avatar_url;
}
