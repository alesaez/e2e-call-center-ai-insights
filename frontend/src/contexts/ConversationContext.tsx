import { createContext, useContext, useCallback, ReactNode, useState } from 'react';

interface ConversationContextType {
  refreshConversations: () => Promise<void>;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const useConversationContext = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    // Return a no-op function if context is not available
    return { 
      refreshConversations: async () => {},
      currentConversationId: null,
      setCurrentConversationId: () => {}
    };
  }
  return context;
};

interface ConversationProviderProps {
  children: ReactNode;
  onRefreshConversations: () => Promise<void>;
}

export const ConversationProvider = ({ children, onRefreshConversations }: ConversationProviderProps) => {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  const refreshConversations = useCallback(async () => {
    await onRefreshConversations();
  }, [onRefreshConversations]);

  return (
    <ConversationContext.Provider value={{ 
      refreshConversations, 
      currentConversationId, 
      setCurrentConversationId 
    }}>
      {children}
    </ConversationContext.Provider>
  );
};