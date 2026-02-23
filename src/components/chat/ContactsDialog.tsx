import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContacts, useAddContact, useRemoveContact, useSearchUsers } from "@/hooks/useContacts";
import { useCreatePrivateConversation } from "@/hooks/useConversations";
import { Search, UserPlus, MessageCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (conversationId: string) => void;
}

export const ContactsDialog = ({ open, onOpenChange, onStartChat }: ContactsDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: contacts, isLoading } = useContacts();
  const { data: searchResults } = useSearchUsers(searchQuery);
  const addContact = useAddContact();
  const removeContact = useRemoveContact();
  const createConversation = useCreatePrivateConversation();
  const { toast } = useToast();

  const handleAddContact = async (userId: string) => {
    try {
      await addContact.mutateAsync(userId);
      toast({ title: "Contact added" });
    } catch {
      toast({ title: "Error", description: "Contact already exists", variant: "destructive" });
    }
  };

  const handleStartChat = async (contactId: string) => {
    try {
      const convId = await createConversation.mutateAsync(contactId);
      onOpenChange(false);
      onStartChat(convId);
    } catch (err: any) {
      console.error("handleStartChat error:", err);
      toast({ title: "Error creating chat", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const contactIds = new Set(contacts?.map((c) => c.contact_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contacts</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="contacts">
          <TabsList className="w-full">
            <TabsTrigger value="contacts" className="flex-1">My Contacts</TabsTrigger>
            <TabsTrigger value="search" className="flex-1">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts">
            <ScrollArea className="h-[350px]">
              {isLoading && <p className="p-4 text-center text-muted-foreground">Loading...</p>}
              {contacts?.length === 0 && <p className="p-4 text-center text-muted-foreground">No contacts</p>}
              {contacts?.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-lg">
                  <Avatar>
                    <AvatarImage src={c.profile.avatar_url ?? undefined} />
                    <AvatarFallback>{c.profile.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{c.profile.display_name}</p>
                    <p className="text-xs text-muted-foreground">{c.profile.is_online ? "online" : "offline"}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleStartChat(c.contact_id)}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeContact.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="search">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="h-[300px]">
              {searchResults?.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-2 py-2 hover:bg-accent rounded-lg">
                  <Avatar>
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback>{u.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{u.display_name}</p>
                  </div>
                  {!contactIds.has(u.id) && (
                    <Button variant="ghost" size="icon" onClick={() => handleAddContact(u.id)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleStartChat(u.id)}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults?.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">No one found</p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
