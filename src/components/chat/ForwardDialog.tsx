import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useConversations } from "@/hooks/useConversations";
import { useSendMessage } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { Message } from "@/hooks/useMessages";

interface ForwardDialogProps {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForwardDialog = ({ message, open, onOpenChange }: ForwardDialogProps) => {
  const { data: conversations } = useConversations();
  const { user } = useAuth();
  const sendMessage = useSendMessage();

  const handleForward = async (convId: string) => {
    sendMessage.mutate({
      conversation_id: convId,
      content: message.content ?? "",
      type: message.type as any,
      file_url: message.file_url ?? undefined,
      file_name: message.file_name ?? undefined,
      file_size: message.file_size ?? undefined,
      forwarded_from_id: message.id,
    });
    onOpenChange(false);
  };

  const getConvName = (conv: any) => {
    if (conv.type === "group") return conv.name || "Group";
    const other = conv.members.find((m: any) => m.user_id !== user?.id);
    return other?.profile?.display_name || "Chat";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <h3 className="text-lg font-semibold mb-3">Forward to:</h3>
        <ScrollArea className="h-[300px]">
          {conversations?.map((conv) => (
            <Button key={conv.id} variant="ghost" className="w-full justify-start mb-1" onClick={() => handleForward(conv.id)}>
              {getConvName(conv)}
            </Button>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
