import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface Member {
  user_id: string;
  role: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_online: boolean | null;
    last_seen: string | null;
  };
}

interface GroupMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  groupName: string;
  onMemberClick?: (userId: string) => void;
}

export const GroupMembersDialog = ({ open, onOpenChange, members, groupName, onMemberClick }: GroupMembersDialogProps) => {
  const getStatusText = (member: Member) => {
    if (member.profile.is_online) return "online";
    if (member.profile.last_seen) {
      const dist = formatDistanceToNow(new Date(member.profile.last_seen), { addSuffix: false });
      return `last seen ${dist} ago`;
    }
    return "offline";
  };

  // Sort: online first, then by last_seen desc
  const sorted = [...members].sort((a, b) => {
    if (a.profile.is_online && !b.profile.is_online) return -1;
    if (!a.profile.is_online && b.profile.is_online) return 1;
    const aTime = a.profile.last_seen ? new Date(a.profile.last_seen).getTime() : 0;
    const bTime = b.profile.last_seen ? new Date(b.profile.last_seen).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm font-semibold">
                {groupName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-base">{groupName}</DialogTitle>
              <p className="text-xs text-muted-foreground">{members.length} members</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="py-1">
            {sorted.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => {
                  onMemberClick?.(member.user_id);
                  onOpenChange(false);
                }}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={member.profile.avatar_url ?? undefined} />
                    <AvatarFallback className="text-sm">
                      {member.profile.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.profile.is_online && (
                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.profile.display_name}</p>
                  <p className={`text-xs ${member.profile.is_online ? "text-green-500" : "text-muted-foreground"}`}>
                    {getStatusText(member)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
