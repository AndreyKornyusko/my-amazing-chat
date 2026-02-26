import { useState, useMemo } from "react";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Moon, Sun, LogOut, Users, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ContactsDialog } from "./ContactsDialog";
import { NewGroupDialog } from "./NewGroupDialog";
import { UserProfileDialog } from "./UserProfileDialog";

interface ChatSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export const ChatSidebar = ({ activeConversationId, onSelectConversation }: ChatSidebarProps) => {
  const { data: conversations, isLoading } = useConversations();
  const { user, signOut } = useAuth();
  const { theme, setTheme, resolved } = useTheme();
  const [search, setSearch] = useState("");
  const [contactsOpen, setContactsOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: profile } = useProfile();

  const totalUnread = useMemo(() => conversations?.reduce((sum, c) => sum + c.unread_count, 0) ?? 0, [conversations]);

  const filtered = useMemo(() => {
    if (!conversations) return [];
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = getConversationName(c, user?.id ?? "");
      return name.toLowerCase().includes(q);
    });
  }, [conversations, search, user]);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 cursor-pointer" onClick={() => setProfileOpen(true)}>
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{(profile?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h1 className="text-lg font-bold">Chats</h1>
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setContactsOpen(true)}>
            <UserPlus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setGroupOpen(true)}>
            <Users className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}>
            {resolved === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search chats..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && <div className="p-4 text-center text-muted-foreground">Loading...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            {search ? "Nothing found" : "No chats yet. Add a contact to get started!"}
          </div>
        )}
        {filtered.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            currentUserId={user?.id ?? ""}
            onClick={() => onSelectConversation(conv.id)}
          />
        ))}
      </ScrollArea>

      <ContactsDialog open={contactsOpen} onOpenChange={setContactsOpen} onStartChat={onSelectConversation} />
      <NewGroupDialog open={groupOpen} onOpenChange={setGroupOpen} onCreated={onSelectConversation} />
      {user && <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} userId={user.id} />}
    </>
  );
};

function getConversationName(conv: ConversationWithDetails, currentUserId: string): string {
  if (conv.type === "group") return conv.name || "Group";
  const other = conv.members.find((m) => m.user_id !== currentUserId);
  return other?.profile?.display_name || "Chat";
}

function getConversationAvatar(conv: ConversationWithDetails, currentUserId: string) {
  if (conv.type === "group") return conv.avatar_url;
  const other = conv.members.find((m) => m.user_id !== currentUserId);
  return other?.profile?.avatar_url;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const ConversationItem = ({
  conversation: conv,
  isActive,
  currentUserId,
  onClick,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}) => {
  const name = getConversationName(conv, currentUserId);
  const avatar = getConversationAvatar(conv, currentUserId);
  const other = conv.members.find((m) => m.user_id !== currentUserId);
  const isOnline = conv.type === "private" && other?.profile?.is_online;

  const lastMsgText = conv.last_message
    ? conv.last_message.type !== "text"
      ? `📎 ${conv.last_message.type}`
      : (conv.last_message.content || "").slice(0, 50)
    : "No messages";

  const time = conv.last_message
    ? formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })
    : "";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
        isActive ? "bg-chat-active text-chat-active-foreground hover:bg-chat-active" : ""
      }`}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-online" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-semibold truncate">{name}</span>
          <span className={`text-xs whitespace-nowrap ${isActive ? "text-chat-active-foreground/70" : "text-muted-foreground"}`}>{time}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${isActive ? "text-chat-active-foreground/70" : "text-muted-foreground"}`}>{lastMsgText}</span>
          {conv.unread_count > 0 && !isActive && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
