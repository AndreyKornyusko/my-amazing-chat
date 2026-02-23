import { useState, useRef, useEffect, useMemo } from "react";
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useMarkAsRead, Message } from "@/hooks/useMessages";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, X, Check, CheckCheck, Pencil, Trash2, Reply, Forward, Search, Play } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ForwardDialog } from "./ForwardDialog";
import { MediaLightbox } from "./MediaLightbox";

interface ChatWindowProps {
  conversationId: string | null;
  onBack?: () => void;
}

export const ChatWindow = ({ conversationId, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const { data: messages, isLoading } = useMessages(conversationId);
  const { data: conversations } = useConversations();
  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const markAsRead = useMarkAsRead();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversation = conversations?.find((c) => c.id === conversationId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!messages || !user || !conversationId) return;
    const unread = messages
      .filter((m) => m.sender_id !== user.id && !(m.read_by ?? []).includes(user.id))
      .map((m) => m.id);
    if (unread.length > 0) {
      markAsRead.mutate({ messageIds: unread, conversationId });
    }
  }, [messages, user, conversationId]);

  const handleSend = async () => {
    if (!conversationId || !text.trim()) return;

    if (editingMsg) {
      editMessage.mutate({ id: editingMsg.id, content: text, conversationId });
      setEditingMsg(null);
      setText("");
      return;
    }

    sendMessage.mutate({
      conversation_id: conversationId,
      content: text,
      reply_to_id: replyTo?.id,
    });
    setText("");
    setReplyTo(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !user) return;

    const ext = file.name.split(".").pop();
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (error) {
      toast({ title: "Upload error", description: error.message, variant: "destructive" });
      return;
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

    e.target.value = "";
  };

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    if (!searchQuery) return messages;
    return messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery]);

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
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarImage src={chatAvatar ?? undefined} />
          <AvatarFallback>{chatName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold">{chatName}</h2>
          <p className="text-xs text-muted-foreground">
            {conversation?.type === "group"
              ? `${conversation.members.length} members`
              : otherUser?.profile?.is_online
              ? "online"
              : "offline"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); }}>
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {searchOpen && (
        <div className="border-b border-border px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" autoFocus />
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-2">
        {isLoading && <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>}
        {filteredMessages.map((msg, i) => {
          const prev = filteredMessages[i - 1];
          const showDate = !prev || !isSameDay(new Date(prev.created_at), new Date(msg.created_at));

          return (
            <div key={msg.id}>
              {showDate && <DateSeparator date={new Date(msg.created_at)} />}
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === user?.id}
                isGroup={conversation?.type === "group"}
                onReply={() => setReplyTo(msg)}
                onEdit={() => { setEditingMsg(msg); setText(msg.content ?? ""); }}
                onDelete={() => deleteMessage.mutate({ id: msg.id, conversationId: conversationId! })}
                onForward={() => setForwardMsg(msg)}
                onMediaClick={(url) => setLightboxUrl(url)}
                searchQuery={searchQuery}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Reply / Edit bar */}
      {(replyTo || editingMsg) && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-2">
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

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="h-5 w-5" />
        </Button>
        <Input
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!text.trim()}>
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {forwardMsg && (
        <ForwardDialog
          message={forwardMsg}
          open={!!forwardMsg}
          onOpenChange={() => setForwardMsg(null)}
        />
      )}

      {lightboxUrl && <MediaLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
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
  searchQuery,
}: {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onMediaClick: (url: string) => void;
  searchQuery: string;
}) => {
  const [showActions, setShowActions] = useState(false);

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

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === searchQuery.toLowerCase() ? <mark key={i} className="bg-primary/30 rounded px-0.5">{p}</mark> : p
    );
  };

  return (
    <div
      className={`group mb-1 flex ${isOwn ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`relative max-w-[75%] rounded-2xl px-3 py-2 ${isOwn ? "bg-chat-bubble-out text-chat-bubble-out-foreground rounded-br-md" : "bg-chat-bubble-in text-chat-bubble-in-foreground rounded-bl-md"}`}>
        {isGroup && !isOwn && (
          <p className="mb-0.5 text-xs font-semibold text-primary">{msg.sender_profile?.display_name}</p>
        )}

        {msg.reply_to && (
          <div className="mb-1 rounded border-l-2 border-primary bg-muted/50 px-2 py-1 text-xs">
            {msg.reply_to.content?.slice(0, 60)}
          </div>
        )}

        {msg.forwarded_from_id && (
          <p className="mb-0.5 text-xs italic text-muted-foreground">↗ Forwarded message</p>
        )}

        {/* Photo preview */}
        {(msg.type === "photo" && msg.file_url) && (
          <div
            className="mb-1 cursor-pointer overflow-hidden rounded-lg"
            onClick={() => onMediaClick(msg.file_url!)}
          >
            <img
              src={msg.file_url}
              alt={msg.file_name || "photo"}
              className="max-h-60 w-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        {/* Video preview with thumbnail */}
        {(msg.type === "video" && msg.file_url) && (
          <div
            className="relative mb-1 cursor-pointer overflow-hidden rounded-lg"
            onClick={() => onMediaClick(msg.file_url!)}
          >
            <video
              src={msg.file_url}
              className="max-h-60 w-full object-cover"
              preload="metadata"
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                <Play className="h-6 w-6 text-foreground ml-0.5" fill="currentColor" />
              </div>
            </div>
          </div>
        )}

        {/* File attachment */}
        {(msg.type === "file" && msg.file_url) && (
          <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded bg-muted/50 p-2 text-sm hover:bg-muted">
            📎 {msg.file_name || "File"}
          </a>
        )}

        {/* Voice message */}
        {(msg.type === "voice" && msg.file_url) && (
          <audio src={msg.file_url} controls className="mb-1 w-full" />
        )}

        {msg.content && msg.type === "text" && (
          <p className="text-sm whitespace-pre-wrap break-words">{highlightText(msg.content)}</p>
        )}

        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isOwn ? "text-chat-bubble-out-foreground/50" : "text-chat-bubble-in-foreground/50"}`}>
          {msg.is_edited && <span>edited</span>}
          <span>{time}</span>
          {isOwn && (
            hasReads ? <CheckCheck className="h-3 w-3 text-read" /> : <Check className="h-3 w-3" />
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="absolute -top-8 right-0 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-md">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReply}><Reply className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onForward}><Forward className="h-3.5 w-3.5" /></Button>
            {isOwn && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </>
            )}
          </div>
        )}
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
