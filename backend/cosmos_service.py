"""
Cosmos DB service for chat history management.
Updated to use separate containers for sessions and messages.
"""
import asyncio
import os
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions
from azure.identity.aio import DefaultAzureCredential
from typing import List, Optional
import logging
from config import Settings
from chat_models import (
    ChatSession, ChatMessage, ChatConversation, ConversationSummary, 
    MessageRole, MessageSender
)
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

class CosmosDBService:
    """Service for managing chat history in Cosmos DB using separate containers for sessions and messages."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client: Optional[CosmosClient] = None
        self.database = None
        self.sessions_container = None  # Partitioned by userId
        self.messages_container = None  # Partitioned by sessionId
        self._initialized = False
    
    async def initialize(self):
        """Initialize Cosmos DB connection and ensure database/containers exist."""
        if self._initialized:
            return
        
        try:
            # Determine if we're running locally or in production
            is_localhost = (
                os.getenv("ENVIRONMENT") == "development" or
                os.getenv("WEBSITE_SITE_NAME") is None  # Azure App Service sets this
            )
            
            if is_localhost and hasattr(self.settings, 'COSMOS_DB_ACCOUNT_URI') and self.settings.COSMOS_DB_ACCOUNT_URI:
                # For localhost development, use DefaultAzureCredential
                logger.info("Using DefaultAzureCredential for Cosmos DB authentication (localhost)")
                credential = DefaultAzureCredential()
                self.client = CosmosClient(
                    url=self.settings.COSMOS_DB_ACCOUNT_URI,
                    credential=credential
                )
            elif self.settings.COSMOS_DB_CONNECTION_STRING:
                # Use connection string for production or when DefaultAzureCredential is not available
                logger.info("Using connection string for Cosmos DB authentication")
                self.client = CosmosClient.from_connection_string(
                    self.settings.COSMOS_DB_CONNECTION_STRING
                )
            else:
                logger.warning("Cosmos DB not configured. Please set either COSMOS_DB_ACCOUNT_URI (for localhost with DefaultAzureCredential) or COSMOS_DB_CONNECTION_STRING. Chat history will not be available.")
                return
            
            # Create database if it doesn't exist
            self.database = await self.client.create_database_if_not_exists(
                id=self.settings.COSMOS_DB_DATABASE_NAME
            )
            
            # Create Sessions container - partitioned by userId
            self.sessions_container = await self.database.create_container_if_not_exists(
                id=self.settings.COSMOS_DB_SESSIONS_CONTAINER,
                partition_key=PartitionKey(path="/userId"),
                offer_throughput=400  # Minimum RU/s for autoscale
            )
            
            # Create Messages container - partitioned by sessionId  
            self.messages_container = await self.database.create_container_if_not_exists(
                id=self.settings.COSMOS_DB_MESSAGES_CONTAINER,
                partition_key=PartitionKey(path="/sessionId"),
                offer_throughput=400  # Minimum RU/s for autoscale
            )
            
            self._initialized = True
            logger.info(f"Cosmos DB initialized: {self.settings.COSMOS_DB_DATABASE_NAME} with containers Sessions and Messages")
            
        except Exception as e:
            logger.error(f"Failed to initialize Cosmos DB: {e}")
            raise
    
    async def create_session(
        self, 
        user_id: str, 
        user_name: str, 
        copilot_conversation_id: str,
        title: Optional[str] = None,
        session_data: Optional[dict] = None,
        tenant_id: Optional[str] = None,
        model: str = "gpt-4o-mini"
    ) -> ChatSession:
        """Create a new chat session in the Sessions container."""
        await self.initialize()
        
        if not self.sessions_container:
            raise Exception("Cosmos DB Sessions container not initialized")
        
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        
        session = ChatSession(
            id=session_id,
            userId=user_id,
            tenantId=tenant_id,
            createdAt=now,
            lastActiveAt=now,
            title=title or "New Conversation",
            model=model,
            metadata={
                "channel": "web",
                "appVersion": "1.0.0",
                "userAgent": "call-center-ai-insights"
            },
            # Legacy compatibility fields
            conversation_id=copilot_conversation_id,
            user_name=user_name,
            session_data=session_data,
            is_active=True
        )
        
        try:
            # Insert into Sessions container
            item = session.model_dump(mode='json')
            item['createdAt'] = session.createdAt.isoformat()
            item['lastActiveAt'] = session.lastActiveAt.isoformat()
            
            await self.sessions_container.create_item(body=item)
            
            logger.info(f"Created session {session_id} for user {user_id}")
            return session
            
        except exceptions.CosmosResourceExistsError:
            # Handle duplicate ID (rare but possible)
            logger.warning(f"Session ID {session_id} already exists, retrying...")
            return await self.create_session(user_id, user_name, copilot_conversation_id, title, session_data, tenant_id, model)
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise

    async def create_conversation(
        self, 
        user_id: str, 
        user_name: str, 
        copilot_conversation_id: str,
        title: Optional[str] = None,
        session_data: Optional[dict] = None
    ) -> ChatConversation:
        """Legacy method: Create a new chat session and return as ChatConversation for backward compatibility."""
        session = await self.create_session(
            user_id=user_id,
            user_name=user_name,
            copilot_conversation_id=copilot_conversation_id,
            title=title,
            session_data=session_data
        )
        
        # Convert to legacy format
        conversation = ChatConversation(
            id=session.id,
            conversation_id=session.conversation_id or copilot_conversation_id,
            user_id=user_id,
            user_name=user_name,
            title=session.title,
            messages=[],
            created_at=session.createdAt,
            updated_at=session.lastActiveAt,
            session_data=session_data,
            is_active=session.is_active
        )
        
        return conversation
    
    async def get_user_conversations(self, user_id: str, limit: int = 50) -> List[ConversationSummary]:
        """Get conversation summaries for a user from Sessions container."""
        await self.initialize()
        
        if not self.sessions_container:
            return []
        
        try:
            # Query sessions for the user
            query = """
            SELECT s.id, s.title, s.createdAt, s.lastActiveAt, 
                   s.is_active, s.conversation_id
            FROM s 
            WHERE s.userId = @user_id AND s.type = 'session' AND s.is_active = true
            ORDER BY s.lastActiveAt DESC
            OFFSET 0 LIMIT @limit
            """
            
            parameters = [
                {"name": "@user_id", "value": user_id},
                {"name": "@limit", "value": limit}
            ]
            
            sessions = []
            async for item in self.sessions_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            ):
                sessions.append(item)
            
            # For each session, get message count from Messages container
            summaries = []
            for session in sessions:
                try:
                    # Count messages for this session
                    message_count = await self._get_message_count(session['id'])
                    
                    # Get last message content
                    last_message = await self._get_last_message(session['id'])
                    
                    summary = ConversationSummary(
                        id=session['id'],
                        conversation_id=session.get('conversation_id', session['id']),
                        title=session['title'],
                        last_message=last_message,
                        message_count=message_count,
                        created_at=datetime.fromisoformat(session['createdAt'].replace('Z', '+00:00')),
                        updated_at=datetime.fromisoformat(session['lastActiveAt'].replace('Z', '+00:00')),
                        is_active=session.get('is_active', True)
                    )
                    summaries.append(summary)
                except Exception as e:
                    logger.warning(f"Failed to process session {session['id']}: {e}")
                    continue
            
            return summaries
            
        except Exception as e:
            logger.error(f"Failed to get conversations for user {user_id}: {e}")
            return []

    async def _get_message_count(self, session_id: str) -> int:
        """Get message count for a session."""
        if not self.messages_container:
            return 0
        
        try:
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.sessionId = @session_id AND c.type = 'message'"
            parameters = [{"name": "@session_id", "value": session_id}]
            
            async for item in self.messages_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=session_id
            ):
                return item
            return 0
        except Exception:
            return 0

    async def _get_last_message(self, session_id: str) -> Optional[str]:
        """Get the last message content for a session."""
        if not self.messages_container:
            return None
        
        try:
            query = """
            SELECT TOP 1 c.content
            FROM c 
            WHERE c.sessionId = @session_id AND c.type = 'message'
            ORDER BY c.createdAt DESC
            """
            parameters = [{"name": "@session_id", "value": session_id}]
            
            async for item in self.messages_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=session_id
            ):
                return item.get('content', '')[:100]  # Truncate to 100 chars
            return None
        except Exception:
            return None
    
    async def get_conversation(self, session_id: str, user_id: str) -> Optional[ChatConversation]:
        """Get a specific conversation by session ID (legacy compatibility)."""
        await self.initialize()
        
        if not self.sessions_container or not self.messages_container:
            return None
        
        try:
            # Get session from Sessions container
            session_item = await self.sessions_container.read_item(
                item=session_id,
                partition_key=user_id
            )
            
            # Get messages from Messages container
            messages = await self.get_session_messages(session_id)
            
            # Convert to legacy ChatConversation format
            conversation = ChatConversation(
                id=session_item['id'],
                conversation_id=session_item.get('conversation_id', session_item['id']),
                user_id=user_id,
                user_name=session_item.get('user_name', ''),
                title=session_item['title'],
                messages=messages,
                created_at=datetime.fromisoformat(session_item['createdAt'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(session_item['lastActiveAt'].replace('Z', '+00:00')),
                session_data=session_item.get('session_data'),
                is_active=session_item.get('is_active', True)
            )
            
            return conversation
            
        except exceptions.CosmosResourceNotFoundError:
            return None
        except Exception as e:
            logger.error(f"Failed to get conversation {session_id}: {e}")
            return None

    async def get_session_messages(self, session_id: str) -> List[ChatMessage]:
        """Get all messages for a session."""
        if not self.messages_container:
            return []
        
        try:
            query = """
            SELECT * FROM c 
            WHERE c.sessionId = @session_id AND c.type = 'message'
            ORDER BY c.createdAt ASC
            """
            parameters = [{"name": "@session_id", "value": session_id}]
            
            messages = []
            async for item in self.messages_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=session_id
            ):
                # Convert to legacy format
                message = ChatMessage(
                    id=item['id'],
                    sessionId=item['sessionId'],
                    role=MessageRole(item['role']),
                    content=item['content'],
                    tokens=item.get('tokens'),
                    createdAt=datetime.fromisoformat(item['createdAt'].replace('Z', '+00:00')),
                    attachments=item.get('attachments', []),
                    toolCalls=item.get('toolCalls'),
                    vector=item.get('vector'),
                    grounding=item.get('grounding'),
                    # Legacy compatibility
                    text=item['content'],
                    sender=MessageSender.USER if item['role'] == 'user' else MessageSender.BOT,
                    timestamp=datetime.fromisoformat(item['createdAt'].replace('Z', '+00:00'))
                )
                messages.append(message)
            
            return messages
            
        except Exception as e:
            logger.error(f"Failed to get messages for session {session_id}: {e}")
            return []
    
    async def add_message_to_session(
        self, 
        session_id: str, 
        user_id: str, 
        content: str,
        role: str = "user",  # Accept string role, convert to MessageRole
        tokens: Optional[int] = None,
        attachments: List = None,
        tool_calls: Optional[List] = None,
        vector: Optional[List[float]] = None,
        grounding: Optional[dict] = None
    ) -> bool:
        """Add a message to a session in the Messages container."""
        await self.initialize()
        
        if not self.messages_container or not self.sessions_container:
            return False
        
        try:
            # Verify session exists and belongs to user
            try:
                await self.sessions_container.read_item(
                    item=session_id,
                    partition_key=user_id
                )
            except exceptions.CosmosResourceNotFoundError:
                logger.warning(f"Session {session_id} not found for user {user_id}")
                return False
            
            # Create new message
            message_id = f"msg_{uuid.uuid4().hex[:12]}"
            now = datetime.utcnow()
            
            # Convert string role to MessageRole enum
            message_role = MessageRole(role) if isinstance(role, str) else role
            
            message = ChatMessage(
                id=message_id,
                sessionId=session_id,
                role=message_role,
                content=content,
                tokens=tokens,
                createdAt=now,
                attachments=attachments or [],
                toolCalls=tool_calls,
                vector=vector,
                grounding=grounding
            )
            
            # Insert message into Messages container
            item = message.model_dump(mode='json')
            item['createdAt'] = message.createdAt.isoformat()
            
            await self.messages_container.create_item(body=item)
            
            # Update session's lastActiveAt and title if needed
            await self._update_session_activity(session_id, user_id, content, role)
            
            logger.info(f"Added message {message_id} to session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add message to session {session_id}: {e}")
            return False

    async def add_message_to_conversation(
        self, 
        conversation_id: str, 
        user_id: str, 
        message: ChatMessage
    ) -> bool:
        """Legacy method: Add a message to a conversation (now maps to session)."""
        # Extract data from legacy ChatMessage format
        content = message.content or message.text or ""
        
        # Handle role conversion from both new and legacy formats
        role_str = "user"  # default
        if hasattr(message, 'role') and message.role:
            # New format: role is MessageRole enum
            role_str = message.role.value if hasattr(message.role, 'value') else str(message.role)
        elif hasattr(message, 'sender') and message.sender:
            # Legacy format: sender is MessageSender enum or string
            sender_str = message.sender.value if hasattr(message.sender, 'value') else str(message.sender)
            role_str = "user" if sender_str == "user" else "assistant"
        
        return await self.add_message_to_session(
            session_id=conversation_id,
            user_id=user_id,
            content=content,
            role=role_str,
            tokens=message.tokens,
            attachments=message.attachments or [],
            tool_calls=message.toolCalls,
            vector=message.vector,
            grounding=message.grounding
        )

    async def _update_session_activity(
        self, 
        session_id: str, 
        user_id: str, 
        content: str, 
        role: str
    ) -> None:
        """Update session's last activity time and title if needed."""
        try:
            # Get current session
            session_item = await self.sessions_container.read_item(
                item=session_id,
                partition_key=user_id
            )
            
            # Update last activity
            session_item['lastActiveAt'] = datetime.utcnow().isoformat()
            
            # Update title if this is the first user message and title is still default
            if (role == "user" and 
                session_item.get('title') in ['New Conversation', 'New Chat']):
                session_item['title'] = content[:50] + ("..." if len(content) > 50 else "")
            
            # Save updated session
            await self.sessions_container.replace_item(
                item=session_id,
                body=session_item
            )
            
        except Exception as e:
            logger.warning(f"Failed to update session activity for {session_id}: {e}")
    
    async def delete_conversation(self, session_id: str, user_id: str) -> bool:
        """Soft delete a conversation (mark session as inactive)."""
        await self.initialize()
        
        if not self.sessions_container:
            return False
        
        try:
            # Get session
            session_item = await self.sessions_container.read_item(
                item=session_id,
                partition_key=user_id
            )
            
            # Mark as inactive
            session_item['is_active'] = False
            session_item['lastActiveAt'] = datetime.utcnow().isoformat()
            
            # Update session
            await self.sessions_container.replace_item(
                item=session_id,
                body=session_item
            )
            
            logger.info(f"Soft deleted session {session_id} for user {user_id}")
            return True
            
        except exceptions.CosmosResourceNotFoundError:
            logger.warning(f"Session {session_id} not found for user {user_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {e}")
            return False

    async def delete_session_messages(self, session_id: str) -> bool:
        """Hard delete all messages for a session."""
        await self.initialize()
        
        if not self.messages_container:
            return False
        
        try:
            # Get all messages for the session
            query = "SELECT c.id FROM c WHERE c.sessionId = @session_id AND c.type = 'message'"
            parameters = [{"name": "@session_id", "value": session_id}]
            
            message_ids = []
            async for item in self.messages_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=session_id
            ):
                message_ids.append(item['id'])
            
            # Delete each message
            for message_id in message_ids:
                await self.messages_container.delete_item(
                    item=message_id,
                    partition_key=session_id
                )
            
            logger.info(f"Deleted {len(message_ids)} messages for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete messages for session {session_id}: {e}")
            return False
    
    async def close(self):
        """Close Cosmos DB client connection."""
        if self.client:
            await self.client.close()
        # Note: DefaultAzureCredential doesn't require explicit cleanup

# Global instance (will be initialized in main.py)
cosmos_service: Optional[CosmosDBService] = None