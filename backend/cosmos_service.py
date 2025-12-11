"""
Cosmos DB service for chat history management.
Updated to use separate containers for sessions and messages.
"""
import asyncio
import os
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions
from azure.identity.aio import DefaultAzureCredential,ManagedIdentityCredential
from typing import List, Optional
import logging
from config import Settings

# Configure Azure SDK logging to be less verbose
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("azure.cosmos").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)
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
        self.credential = None  # Store credential for proper cleanup
        self.database = None
        self.sessions_container = None  # Partitioned by userId
        self.messages_container = None  # Partitioned by sessionId
        self._initialized = False
    
    async def initialize(self):
        """Initialize Cosmos DB connection and ensure database/containers exist."""
        if self._initialized:
            logger.info("✓ Cosmos DB: Already initialized and ready")
            return
        
        try:
            # Determine if we're running locally or in Azure Container Apps
            # Azure Container Apps sets CONTAINER_APP_NAME environment variable
            # For local development, ENVIRONMENT can be set to "development"
            is_localhost = (
                os.getenv("ENVIRONMENT") == "development" or
                os.getenv("CONTAINER_APP_NAME") is None  # Azure Container Apps sets this
            )
            
            logger.info(f"Cosmos DB: Environment detection - is_localhost={is_localhost}, "
                       f"ENVIRONMENT={os.getenv('ENVIRONMENT')}, "
                       f"CONTAINER_APP_NAME={os.getenv('CONTAINER_APP_NAME')}")
            
            # Validate configuration
            if not self.settings.COSMOS_DB_ACCOUNT_URI:
                raise ValueError("COSMOS_DB_ACCOUNT_URI is required for Cosmos DB initialization")
            
            logger.info(f"Cosmos DB: Account URI configured: {self.settings.COSMOS_DB_ACCOUNT_URI}")
            
            if is_localhost:
                # For localhost development, use DefaultAzureCredential (Azure CLI, Visual Studio, etc.)
                logger.info("Cosmos DB: Using DefaultAzureCredential for localhost development")
                self.credential = DefaultAzureCredential()
                self.client = CosmosClient(
                    url=self.settings.COSMOS_DB_ACCOUNT_URI,
                    credential=self.credential
                )
                logger.info("✓ Cosmos DB: Client created with DefaultAzureCredential")
            else:
                # For Azure Container Apps, use ManagedIdentityCredential
                logger.info("Cosmos DB: Using ManagedIdentityCredential for Azure Container Apps")
                self.credential = ManagedIdentityCredential()
                self.client = CosmosClient(
                    url=self.settings.COSMOS_DB_ACCOUNT_URI,
                    credential=self.credential
                )
                logger.info("✓ Cosmos DB: Client created with ManagedIdentityCredential")
            
            # Create database if it doesn't exist
            logger.info(f"Cosmos DB: Creating/accessing database '{self.settings.COSMOS_DB_DATABASE_NAME}'")
            self.database = await self.client.create_database_if_not_exists(
                id=self.settings.COSMOS_DB_DATABASE_NAME
            )
            logger.info(f"✓ Cosmos DB: Database '{self.settings.COSMOS_DB_DATABASE_NAME}' ready")
            
            # Create Sessions container - partitioned by userId
            logger.info(f"Cosmos DB: Creating/accessing sessions container '{self.settings.COSMOS_DB_SESSIONS_CONTAINER}'")
            self.sessions_container = await self.database.create_container_if_not_exists(
                id=self.settings.COSMOS_DB_SESSIONS_CONTAINER,
                partition_key=PartitionKey(path="/userId"),
                offer_throughput=400  # Minimum RU/s for autoscale
            )
            logger.info(f"✓ Cosmos DB: Sessions container ready (partition key: /userId)")
            
            # Create Messages container - partitioned by sessionId  
            logger.info(f"Cosmos DB: Creating/accessing messages container '{self.settings.COSMOS_DB_MESSAGES_CONTAINER}'")
            self.messages_container = await self.database.create_container_if_not_exists(
                id=self.settings.COSMOS_DB_MESSAGES_CONTAINER,
                partition_key=PartitionKey(path="/sessionId"),
                offer_throughput=400  # Minimum RU/s for autoscale
            )
            logger.info(f"✓ Cosmos DB: Messages container ready (partition key: /sessionId)")
            
            self._initialized = True
            logger.info("✓ Cosmos DB: Initialization complete")
            
        except exceptions.CosmosHttpResponseError as e:
            logger.error(f"❌ Cosmos DB HTTP Error: status_code={e.status_code}, "
                        f"sub_status={getattr(e, 'sub_status', 'N/A')}, "
                        f"message={e.message}")
            raise
        except Exception as e:
            logger.error(f"❌ Cosmos DB: Initialization failed - {type(e).__name__}: {e}")
            raise
    
    async def create_session(
        self, 
        user_id: str, 
        user_name: str, 
        copilot_conversation_id: str,
        title: Optional[str] = None,
        metadata: Optional[dict] = None,
        tenant_id: Optional[str] = None,
        model: str = "gpt-4o-mini",
        agent_id: Optional[str] = None
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
            metadata=metadata or {
                "channel": "web",
                "appVersion": "1.0.0",
                "userAgent": "call-center-ai-insights"
            },
            agentId=agent_id,
            conversation_id=copilot_conversation_id,
            user_name=user_name,
            is_active=True
        )
        
        try:
            # Insert into Sessions container
            item = session.model_dump(mode='json')
            item['createdAt'] = session.createdAt.isoformat()
            item['lastActiveAt'] = session.lastActiveAt.isoformat()
            
            await self.sessions_container.create_item(body=item)
            
            return session
            
        except exceptions.CosmosResourceExistsError:
            # Handle duplicate ID (rare but possible)
            return await self.create_session(user_id, user_name, copilot_conversation_id, title, metadata, tenant_id, model, agent_id)
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise
    
    async def get_user_conversations(self, user_id: str, limit: int = 50, agent_id: Optional[str] = None) -> List[ConversationSummary]:
        """Get conversation summaries for a user from Sessions container."""
        await self.initialize()
        
        logger.info(f"Cosmos DB: Fetching conversations - user_id={user_id}, agent_id={agent_id}, limit={limit}")
        
        if not self.sessions_container:
            logger.error("❌ Cosmos DB: Sessions container not initialized")
            return []
        
        try:
            # Build query with optional agentId filter
            if agent_id:
                query = """
                SELECT s.id, s.title, s.createdAt, s.lastActiveAt, 
                       s.is_active, s.conversation_id, s.agentId
                FROM s 
                WHERE s.userId = @user_id AND s.type = 'session' AND s.is_active = true 
                      AND s.agentId = @agent_id
                ORDER BY s.lastActiveAt DESC
                OFFSET 0 LIMIT @limit
                """
                parameters = [
                    {"name": "@user_id", "value": user_id},
                    {"name": "@agent_id", "value": agent_id},
                    {"name": "@limit", "value": limit}
                ]
                logger.info(f"Cosmos DB: Query with agent filter - agent_id={agent_id}")
            else:
                query = """
                SELECT s.id, s.title, s.createdAt, s.lastActiveAt, 
                       s.is_active, s.conversation_id, s.agentId
                FROM s 
                WHERE s.userId = @user_id AND s.type = 'session' AND s.is_active = true
                ORDER BY s.lastActiveAt DESC
                OFFSET 0 LIMIT @limit
                """
                parameters = [
                    {"name": "@user_id", "value": user_id},
                    {"name": "@limit", "value": limit}
                ]
                logger.info("Cosmos DB: Query without agent filter")
            
            logger.info(f"Cosmos DB: Executing query on Sessions container with partition_key={user_id}")
            sessions = []
            async for item in self.sessions_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            ):
                sessions.append(item)
            
            logger.info(f"✓ Cosmos DB: Found {len(sessions)} sessions for user {user_id}")
            
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
                    logger.warning(f"⚠ Cosmos DB: Failed to process session {session['id']}: {e}")
                    continue
            
            logger.info(f"✓ Cosmos DB: Returning {len(summaries)} conversation summaries")
            return summaries
            
        except exceptions.CosmosHttpResponseError as e:
            logger.error(f"❌ Cosmos DB HTTP Error getting conversations: status_code={e.status_code}, "
                        f"sub_status={getattr(e, 'sub_status', 'N/A')}, message={e.message}")
            return []
        except Exception as e:
            logger.error(f"❌ Cosmos DB: Failed to get conversations for user {user_id}: {type(e).__name__}: {e}")
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
            
            # Convert to ChatConversation format
            conversation = ChatConversation(
                id=session_item['id'],
                conversation_id=session_item.get('conversation_id', session_item['id']),
                user_id=user_id,
                user_name=session_item.get('user_name', ''),
                title=session_item['title'],
                messages=messages,
                created_at=datetime.fromisoformat(session_item['createdAt'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(session_item['lastActiveAt'].replace('Z', '+00:00')),
                agent_id=session_item.get('agentId'),
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
            
            return True
            
        except exceptions.CosmosResourceNotFoundError:
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
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete messages for session {session_id}: {e}")
            return False
    
    async def health_check(self) -> dict:
        """Perform a health check on Cosmos DB connection."""
        try:
            await self.initialize()
            
            if not self.client:
                return {"status": "unhealthy", "error": "Client not initialized"}
            
            if not self.database:
                return {"status": "unhealthy", "error": "Database not initialized"}
            
            if not self.sessions_container or not self.messages_container:
                return {"status": "unhealthy", "error": "Containers not initialized"}
            
            # Try a simple query to verify connectivity and permissions
            query = "SELECT VALUE COUNT(1) FROM c"
            count = 0
            async for item in self.sessions_container.query_items(query=query):
                count = item
                break
            
            return {
                "status": "healthy",
                "database": self.settings.COSMOS_DB_DATABASE_NAME,
                "sessions_container": self.settings.COSMOS_DB_SESSIONS_CONTAINER,
                "messages_container": self.settings.COSMOS_DB_MESSAGES_CONTAINER,
                "test_query_result": f"Sessions container has {count} items"
            }
            
        except exceptions.CosmosHttpResponseError as e:
            return {
                "status": "unhealthy",
                "error": f"HTTP {e.status_code}: {e.message}",
                "sub_status": getattr(e, 'sub_status', 'N/A')
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": f"{type(e).__name__}: {str(e)}"
            }
    
    async def close(self):
        """Close Cosmos DB client and credential connections."""
        if self.client:
            await self.client.close()
            logger.info("✓ Cosmos DB: Client closed")
        
        # Close credential if it exists and has a close method
        if self.credential and hasattr(self.credential, 'close'):
            await self.credential.close()
            logger.info("✓ Cosmos DB: Credential closed")

# Global instance (will be initialized in main.py)
cosmos_service: Optional[CosmosDBService] = None