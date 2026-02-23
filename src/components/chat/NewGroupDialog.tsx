import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useContacts } from "@/hooks/useContacts";
import { useCreateGroupConversation } from "@/hooks/useConversations";
import { useToast } from "@/hooks/use-toast";

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export const NewGroupDialog = ({ open, onOpenChange, onCreated }: NewGroupDialogProps) => {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: contacts } = useContacts();
  const createGroup = useCreateGroupConversation();
  const { toast } = useToast();

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Enter a group name", variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "Select at least one member", variant: "destructive" });
      return;
    }
    const convId = await createGroup.mutateAsync({ name, memberIds: Array.from(selected) });
    onOpenChange(false);
    onCreated(convId);
    setName("");
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Group</DialogTitle>
        </DialogHeader>
        <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} className="mb-3" />
        <p className="text-sm text-muted-foreground mb-2">Select members:</p>
        <ScrollArea className="h-[300px]">
          {contacts?.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 px-2 py-2 hover:bg-accent rounded-lg">
              <Checkbox checked={selected.has(c.contact_id)} onCheckedChange={() => toggle(c.contact_id)} />
              <Avatar className="h-8 w-8">
                <AvatarImage src={c.profile.avatar_url ?? undefined} />
                <AvatarFallback>{c.profile.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{c.profile.display_name}</span>
            </label>
          ))}
          {contacts?.length === 0 && <p className="p-4 text-center text-muted-foreground">Add contacts first</p>}
        </ScrollArea>
        <Button onClick={handleCreate} disabled={createGroup.isPending} className="w-full mt-2">
          {createGroup.isPending ? "Creating..." : `Create group (${selected.size})`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
