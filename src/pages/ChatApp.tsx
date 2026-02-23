import { useState } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useIsMobile } from "@/hooks/use-mobile";

const ChatApp = () => {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(true);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (isMobile) setShowSidebar(false);
  };

  const handleBack = () => {
    setShowSidebar(true);
    if (isMobile) setActiveConversationId(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {(!isMobile || showSidebar) && (
        <div className={`${isMobile ? "w-full" : "w-[380px] min-w-[320px] border-r border-border"} flex flex-col h-full overflow-hidden`}>
          <ChatSidebar
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      )}
      {(!isMobile || !showSidebar) && (
        <div className="flex flex-1 flex-col h-full overflow-hidden">
          <ChatWindow
            conversationId={activeConversationId}
            onBack={isMobile ? handleBack : undefined}
          />
        </div>
      )}
    </div>
  );
};

export default ChatApp;
