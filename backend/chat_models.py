"""
Cosmos DB models for chat history management.
Updated to use separate containers for sessions and messages.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class MessageRole(str, Enum):
    """Message roles in the conversation."""
    USER = "user"
    ASSISTANT = "assistant" 
    TOOL = "tool"

class MessageSender(str, Enum):
    """Legacy enum for backward compatibility."""
    USER = "user"
    BOT = "bot"

class AttachmentKind(str, Enum):
    """Types of message attachments."""
    FILE = "file"
    IMAGE = "image"
    DOCUMENT = "document"
    ANNOTATION = "annotation"  # For citations/references
    VISUALIZATION = "visualization"  # For generated charts/plots

class MessageAttachment(BaseModel):
    """Message attachment model."""
    kind: Optional[AttachmentKind] = None  # Made optional for backward compatibility
    uri: Optional[str] = None  # Optional for base64 images
    mime: Optional[str] = None
    title: Optional[str] = None
    contentType: Optional[str] = None  # MIME type for attachments (e.g., "image/png", "application/vnd.microsoft.card.adaptive")
    content: Optional[Any] = None  # For base64 images or adaptive card content
    name: Optional[str] = None  # File name

class MessageGrounding(BaseModel):
    """Message grounding information for AI responses."""
    sources: List[str] = []
    citations: List[Dict[str, str]] = []

class ToolCall(BaseModel):
    """Tool call information for function calling."""
    id: str
    name: str
    arguments: Dict[str, Any]
    result: Optional[Any] = None

class ChatSession(BaseModel):
    """Chat session model stored in Sessions container."""
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )
    
    id: str  # Session ID (sess_xxxx)
    type: str = "session"  # Document type identifier
    userId: str  # Partition key - User's object ID from Entra ID
    tenantId: Optional[str] = None  # Tenant identifier
    createdAt: datetime
    lastActiveAt: datetime
    title: str
    model: str = "gpt-4o-mini"
    metadata: Dict[str, Any] = {}
    agentId: Optional[str] = None  # Agent identifier for filtering conversations
    
    # Agent conversation reference
    conversation_id: Optional[str] = None  # Agent-specific conversation ID (e.g., Copilot Studio or AI Foundry thread ID)
    user_name: Optional[str] = None  # User's display name
    is_active: bool = True

class MessageFeedback(str, Enum):
    """Feedback types for messages."""
    POSITIVE = "positive"  # Thumbs up
    NEGATIVE = "negative"  # Thumbs down

class ChatMessage(BaseModel):
    """Individual chat message model stored in Messages container."""
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )
    
    id: str  # Message ID (msg_xxxx)
    type: str = "message"  # Document type identifier
    sessionId: str  # Partition key - Session ID this message belongs to
    role: MessageRole  # Message role (user/assistant/tool)
    content: str  # Message content
    tokens: Optional[int] = None  # Token count
    createdAt: datetime
    attachments: List[MessageAttachment] = []
    toolCalls: Optional[List[ToolCall]] = None
    vector: Optional[List[float]] = None  # Embedding for semantic cache
    grounding: Optional[MessageGrounding] = None
    feedback: Optional[MessageFeedback] = None  # User feedback (thumbs up/down)
    
    # Legacy compatibility fields
    text: Optional[str] = None  # Alias for content
    sender: Optional[MessageSender] = None  # Legacy sender field
    timestamp: Optional[datetime] = None  # Alias for createdAt

class ChatConversation(BaseModel):
    """Conversation model for API responses."""
    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )
    
    id: str  # Session ID
    conversation_id: str  # Agent-specific conversation ID
    user_id: str  # User's object ID from Entra ID
    user_name: str  # User's display name
    title: str  # Conversation title
    messages: List[ChatMessage] = []
    created_at: datetime
    updated_at: datetime
    agent_id: Optional[str] = None  # Agent identifier
    is_active: bool = True

class ConversationSummary(BaseModel):
    """Summary model for conversation list."""
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )
    
    id: str
    conversation_id: str
    title: str
    last_message: Optional[str] = None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

class CreateConversationRequest(BaseModel):
    """Request model for creating a new conversation."""
    title: Optional[str] = None
    agent_id: Optional[str] = None  # Agent identifier (e.g., schema_name for Copilot Studio, agent_id for AI Foundry)
    metadata: Optional[dict] = None  # Optional metadata for the conversation

class AddMessageRequest(BaseModel):
    """Request model for adding a message to conversation."""
    conversation_id: str
    message: ChatMessage