"""
Conversation service for managing chat sessions and messages across different agents.
This service provides a unified interface for conversation management that can be used
by multiple chatbot implementations (Copilot Studio, AI Foundry, etc.).
"""
from typing import List, Optional
from cosmos_service import CosmosDBService
from chat_models import (
    ChatConversation,
    ConversationSummary,
    ChatMessage,
    MessageRole,
    MessageFeedback,
    CreateConversationRequest,
    AddMessageRequest
)
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)


class ConversationService:
    """
    Unified service for managing conversations and messages.
    Provides agent-agnostic methods for conversation storage and retrieval.
    """
    
    def __init__(self, cosmos_service: Optional[CosmosDBService] = None):
        """
        Initialize the conversation service.
        
        Args:
            cosmos_service: Optional Cosmos DB service for persistence
        """
        self.cosmos_service = cosmos_service
        self._in_memory_store: dict = {}  # Fallback for when Cosmos is not available
    
    async def create_conversation(
        self,
        user_id: str,
        user_name: str,
        agent_conversation_id: str,
        title: Optional[str] = None,
        agent_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        session_data: Optional[dict] = None
    ) -> ChatConversation:
        """
        Create a new conversation session.
        
        Args:
            user_id: User identifier
            user_name: User display name
            agent_conversation_id: The conversation ID from the agent (e.g., Copilot Studio)
            title: Optional conversation title
            agent_id: Agent identifier (e.g., schema_name for Copilot Studio, agent_id for AI Foundry)
            metadata: Optional additional metadata
            session_data: Optional AI Foundry/Copilot Studio session data for resuming conversations
            
        Returns:
            ChatConversation object
        """
        if self.cosmos_service:
            try:
                # Create session with agent_id
                session = await self.cosmos_service.create_session(
                    user_id=user_id,
                    user_name=user_name,
                    copilot_conversation_id=agent_conversation_id,
                    title=title,
                    metadata=metadata,
                    agent_id=agent_id,
                    session_data=session_data
                )
                
                # Convert to conversation
                conversation = ChatConversation(
                    id=session.id,
                    conversation_id=session.conversation_id or agent_conversation_id,
                    user_id=user_id,
                    user_name=user_name,
                    title=session.title,
                    messages=[],
                    created_at=session.createdAt,
                    updated_at=session.lastActiveAt,
                    agent_id=agent_id,
                    is_active=session.is_active,
                    session_data=session.session_data
                )
                
                logger.info(f"Created conversation in Cosmos: {conversation.id} for agent: {agent_id}")
                return conversation
                
            except Exception as e:
                logger.error(f"Failed to create conversation in Cosmos: {e}")
                # Fall through to in-memory store
        
        # Fallback to in-memory store
        conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
            
        conversation = ChatConversation(
            id=conversation_id,
            conversation_id=agent_conversation_id,
            user_id=user_id,
            user_name=user_name,
            title=title or "New Conversation",
            messages=[],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            agent_id=agent_id,
            is_active=True,
            session_data=session_data
        )
        
        self._in_memory_store[conversation_id] = conversation
        logger.info(f"Created conversation in memory: {conversation_id} for agent: {agent_id}")
        return conversation
    
    async def get_user_conversations(
        self,
        user_id: str,
        limit: int = 50,
        agent_id: Optional[str] = None
    ) -> List[ConversationSummary]:
        """
        Get conversation summaries for a user.
        
        Args:
            user_id: User identifier
            limit: Maximum number of conversations to return
            agent_id: Optional filter by agent ID
            
        Returns:
            List of ConversationSummary objects
        """
        if self.cosmos_service:
            try:
                summaries = await self.cosmos_service.get_user_conversations(user_id, limit, agent_id)
                return summaries
                
            except Exception as e:
                logger.error(f"Failed to get conversations from Cosmos: {e}")
                # Fall through to in-memory store
        
        # Fallback to in-memory store
        user_conversations = [
            conv for conv in self._in_memory_store.values()
            if conv.user_id == user_id and conv.is_active
        ]
        
        # Filter by agent_id if specified
        if agent_id:
            user_conversations = [
                conv for conv in user_conversations
                if conv.agent_id == agent_id
            ]
        
        # Convert to summaries
        summaries = [
            ConversationSummary(
                id=conv.id,
                conversation_id=conv.conversation_id,
                title=conv.title,
                last_message=conv.messages[-1].content if conv.messages else None,
                message_count=len(conv.messages),
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                is_active=conv.is_active
            )
            for conv in sorted(user_conversations, key=lambda x: x.updated_at, reverse=True)[:limit]
        ]
        
        return summaries
    
    async def get_conversation(
        self,
        conversation_id: str,
        user_id: str
    ) -> Optional[ChatConversation]:
        """
        Get a specific conversation by ID.
        
        Args:
            conversation_id: Conversation identifier
            user_id: User identifier (for authorization)
            
        Returns:
            ChatConversation object or None if not found
        """
        if self.cosmos_service:
            try:
                conversation = await self.cosmos_service.get_conversation(conversation_id, user_id)
                return conversation
                
            except Exception as e:
                logger.error(f"Failed to get conversation from Cosmos: {e}")
                # Fall through to in-memory store
        
        # Fallback to in-memory store
        conversation = self._in_memory_store.get(conversation_id)
        if conversation and conversation.user_id == user_id:
            return conversation
        
        return None
    
    async def get_conversation_messages(
        self,
        conversation_id: str,
        user_id: str
    ) -> List[ChatMessage]:
        """
        Get all messages for a conversation.
        
        Args:
            conversation_id: Conversation identifier
            user_id: User identifier (for authorization)
            
        Returns:
            List of ChatMessage objects
        """
        conversation = await self.get_conversation(conversation_id, user_id)
        if conversation:
            return conversation.messages
        return []
    
    async def add_message(
        self,
        conversation_id: str,
        user_id: str,
        content: str,
        role: str = "user",
        attachments: Optional[List] = None,
        metadata: Optional[dict] = None
    ) -> Optional[str]:
        """
        Add a message to a conversation.
        
        Args:
            conversation_id: Conversation identifier
            user_id: User identifier (for authorization)
            content: Message content
            role: Message role ("user" or "assistant")
            attachments: Optional list of attachments
            metadata: Optional additional metadata (tokens, tool calls, etc.)
            
        Returns:
            The created message ID if successful, None otherwise
        """
        if self.cosmos_service:
            try:
                # Extract metadata fields if provided
                tokens = metadata.get("tokens") if metadata else None
                tool_calls = metadata.get("toolCalls") if metadata else None
                vector = metadata.get("vector") if metadata else None
                grounding = metadata.get("grounding") if metadata else None
                
                created_message_id = await self.cosmos_service.add_message_to_session(
                    session_id=conversation_id,
                    user_id=user_id,
                    content=content,
                    role=role,
                    tokens=tokens,
                    attachments=attachments or [],
                    tool_calls=tool_calls,
                    vector=vector,
                    grounding=grounding
                )
                
                if created_message_id:
                    logger.info(f"Added message {created_message_id} to conversation {conversation_id} in Cosmos")
                    return created_message_id
                    
            except Exception as e:
                logger.error(f"Failed to add message to Cosmos: {e}")
                # Fall through to in-memory store
        
        # Fallback to in-memory store
        conversation = self._in_memory_store.get(conversation_id)
        if conversation and conversation.user_id == user_id:
            generated_message_id = f"msg_{uuid.uuid4().hex[:12]}"
            message = ChatMessage(
                id=generated_message_id,
                sessionId=conversation_id,
                role=MessageRole(role),
                content=content,
                tokens=metadata.get("tokens") if metadata else None,
                createdAt=datetime.utcnow(),
                attachments=attachments or [],
                toolCalls=metadata.get("toolCalls") if metadata else None,
                vector=metadata.get("vector") if metadata else None,
                grounding=metadata.get("grounding") if metadata else None
            )
            
            conversation.messages.append(message)
            conversation.updated_at = datetime.utcnow()
            
            logger.info(f"Added message {generated_message_id} to conversation {conversation_id} in memory")
            return generated_message_id
        
        return None
    
    async def update_message_feedback(
        self,
        session_id: str,
        message_id: str,
        feedback: Optional[str]
    ) -> bool:
        """
        Update the feedback (thumbs up/down) for a specific message.
        
        Args:
            session_id: Session/conversation identifier
            message_id: Message identifier
            feedback: 'positive', 'negative', or None to clear
            
        Returns:
            True if successful, False otherwise
        """
        if self.cosmos_service:
            try:
                success = await self.cosmos_service.update_message_feedback(
                    session_id=session_id,
                    message_id=message_id,
                    feedback=feedback
                )
                if success:
                    logger.info(f"Updated feedback for message {message_id} to {feedback}")
                    return True
                    
            except Exception as e:
                logger.error(f"Failed to update message feedback in Cosmos: {e}")
        
        # Fallback to in-memory store
        conversation = self._in_memory_store.get(session_id)
        if conversation:
            for msg in conversation.messages:
                if msg.id == message_id:
                    msg.feedback = MessageFeedback(feedback) if feedback else None
                    logger.info(f"Updated feedback for message {message_id} to {feedback} in memory")
                    return True
        
        return False
    
    async def update_session_data(
        self,
        conversation_id: str,
        user_id: str,
        session_data: dict
    ) -> bool:
        """
        Update session_data on an existing conversation.
        Used when resuming a legacy conversation that had no AI Foundry thread stored.
        """
        if self.cosmos_service:
            try:
                return await self.cosmos_service.update_session_data(conversation_id, user_id, session_data)
            except Exception as e:
                logger.error(f"Failed to update session_data for {conversation_id}: {e}")
                return False
        return False

    async def delete_conversation(
        self,
        conversation_id: str,
        user_id: str
    ) -> bool:
        """
        Delete (soft delete) a conversation.
        
        Args:
            conversation_id: Conversation identifier
            user_id: User identifier (for authorization)
            
        Returns:
            True if successful, False otherwise
        """
        if self.cosmos_service:
            try:
                success = await self.cosmos_service.delete_conversation(conversation_id, user_id)
                if success:
                    logger.info(f"Deleted conversation {conversation_id} from Cosmos")
                    return True
                    
            except Exception as e:
                logger.error(f"Failed to delete conversation from Cosmos: {e}")
                # Fall through to in-memory store
        
        # Fallback to in-memory store
        conversation = self._in_memory_store.get(conversation_id)
        if conversation and conversation.user_id == user_id:
            conversation.is_active = False
            logger.info(f"Deleted conversation {conversation_id} from memory")
            return True
        
        return False
    
    def is_available(self) -> bool:
        """Check if the conversation service is available (has Cosmos or in-memory store)."""
        return self.cosmos_service is not None or len(self._in_memory_store) >= 0
