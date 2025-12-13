"""
Azure AI Foundry service for agent interactions.
Handles session creation, message sending, and agent interactions using Azure AI Projects.
Uses MSAL On-Behalf-Of (OBO) flow for authentication.
"""
from typing import Dict, List, Optional, Any
import msal
from azure.core.credentials import AccessToken
from azure.ai.projects import AIProjectClient
from config import Settings
import logging
import asyncio

logger = logging.getLogger(__name__)


class TokenCredential:
    """Custom credential wrapper for MSAL token."""
    def __init__(self, token: str):
        self._token = token
    
    def get_token(self, *scopes, **kwargs) -> AccessToken:
        """Return the token in the format expected by Azure SDK."""
        import time
        # Token is valid for 1 hour (typical for MSAL tokens)
        expires_on = int(time.time()) + 3600
        return AccessToken(self._token, expires_on)


class AIFoundryService:
    """Service for interacting with Azure AI Foundry agents."""
    
    def __init__(self, settings: Settings, visualization_service=None):
        """Initialize the Azure AI Foundry service with MSAL OBO authentication."""
        if not settings.ai_foundry:
            raise ValueError("Azure AI Foundry settings not configured")
        
        self.settings = settings
        self.ai_foundry_settings = settings.ai_foundry
        self.visualization_service = visualization_service
        
        # Initialize MSAL Confidential Client Application for OBO flow
        self.msal_app = msal.ConfidentialClientApplication(
            client_id=self.ai_foundry_settings.app_client_id,
            client_credential=self.ai_foundry_settings.app_client_secret,
            authority=f"https://login.microsoftonline.com/{self.ai_foundry_settings.tenant_id}"
        )
        
        logger.info(f"✓ Azure AI Foundry service initialized")
        logger.info(f"  Project: {self.ai_foundry_settings.project_name}")
        logger.info(f"  Agent: {self.ai_foundry_settings.agent_id}")
        logger.info(f"  Endpoint: {self.ai_foundry_settings.host}")
    
    def _get_azure_ai_token(self, user_token: str) -> str:
        """
        Exchange user token for Azure AI services token using MSAL On-Behalf-Of flow.
        
        Args:
            user_token: The user's access token from the frontend
            
        Returns:
            Access token for Azure AI services
        """
        try:
            # Scope for Azure AI Foundry (https://ai.azure.com is the correct audience)
            scopes = ["https://ai.azure.com/.default"]
            
            # Perform On-Behalf-Of token exchange
            result = self.msal_app.acquire_token_on_behalf_of(
                user_assertion=user_token,
                scopes=scopes
            )
            
            if "access_token" in result:
                logger.info("Successfully acquired Azure AI token via OBO flow")
                return result["access_token"]
            else:
                error_msg = result.get("error_description", result.get("error", "Unknown error"))
                logger.error(f"Failed to acquire Azure AI token: {error_msg}")
                raise ValueError(f"MSAL OBO token acquisition failed: {error_msg}")
                
        except Exception as e:
            logger.error(f"Error in MSAL OBO flow: {e}")
            raise
    
    async def start_conversation(
        self, 
        user_token: str,
        user_id: str,
        user_name: str
    ) -> Dict:
        """
        Start a new conversation with Azure AI Foundry.
        
        Args:
            user_token: User's access token for OBO flow
            user_id: User identifier
            user_name: User display name
            
        Returns:
            Dict containing conversationId, welcomeMessage, and session details
        """
        try:
            # Get Azure AI token via OBO flow
            azure_ai_token = self._get_azure_ai_token(user_token)
            credential = TokenCredential(azure_ai_token)
            
            # Create AI Project Client with OBO token
            # Use the full endpoint URL directly
            client = AIProjectClient(
                endpoint=self.ai_foundry_settings.endpoint,
                credential=credential
            )
            
            # Create a new thread for the conversation
            thread = await asyncio.to_thread(
                client.agents.threads.create
            )
            
            conversation_id = thread.id
            
            # Get welcome message if agent has one configured
            welcome_message = "Hello! How can I assist you today?"
            
            # Try to get the first message from the agent if configured
            if self.ai_foundry_settings.send_welcome_message:
                try:
                    # Send a greeting to trigger welcome message
                    messages = await asyncio.to_thread(
                        client.agents.messages.list,
                        thread_id=conversation_id
                    )
                    
                    # messages is an ItemPaged iterator, convert to list
                    messages_list = list(messages)
                    if messages_list and len(messages_list) > 0:
                        first_message = messages_list[0]
                        if hasattr(first_message, 'content') and first_message.content:
                            for content in first_message.content:
                                # Check if content has text attribute (duck typing)
                                if hasattr(content, 'text') and hasattr(content.text, 'value'):
                                    welcome_message = content.text.value
                                    break
                except Exception as e:
                    logger.warning(f"Failed to get welcome message: {e}")
            
            return {
                "conversationId": conversation_id,
                "userId": user_id,
                "userName": user_name,
                "projectName": self.ai_foundry_settings.project_name,
                "agentId": self.ai_foundry_settings.agent_id,
                "expiresIn": 3600,  # 1 hour
                "sessionCreated": True,
                "welcomeMessage": welcome_message
            }
            
        except Exception as e:
            logger.error(f"Failed to start Azure AI Foundry conversation: {e}")
            raise
    
    async def send_message(
        self,
        conversation_id: str,
        message_text: str,
        user_token: str,
        user_id: str
    ) -> Dict:
        """
        Send a message to Azure AI Foundry and receive response.
        
        Args:
            conversation_id: The thread ID from Azure AI Foundry
            message_text: The message to send
            user_token: User's access token for OBO flow
            user_id: User identifier
            
        Returns:
            Dict containing response text, attachments, and activities
        """
        try:
            # Get Azure AI token via OBO flow
            azure_ai_token = self._get_azure_ai_token(user_token)
            credential = TokenCredential(azure_ai_token)
            
            # Create AI Project Client with OBO token
            client = AIProjectClient(
                endpoint=self.ai_foundry_settings.endpoint,
                credential=credential
            )
            
            # Add user message to thread
            await asyncio.to_thread(
                client.agents.messages.create,
                thread_id=conversation_id,
                role="user",
                content=message_text
            )
            
            # Create and poll the run
            run = await asyncio.to_thread(
                client.agents.runs.create_and_process,
                thread_id=conversation_id,
                agent_id=self.ai_foundry_settings.agent_id
            )
            
            # Get the latest messages after the run completes
            messages = await asyncio.to_thread(
                client.agents.messages.list,
                thread_id=conversation_id
            )
            
            response_text = ""
            attachments = []
            
            # Extract the assistant's response (most recent message)
            # messages is an ItemPaged iterator, convert to list
            messages_list = list(messages)
            if messages_list and len(messages_list) > 0:
                # Find the first assistant message
                for message in messages_list:
                    if message.role == "assistant":
                        # Extract text content
                        for content in message.content:
                            # Check if content has text attribute (duck typing)
                            if hasattr(content, 'text') and hasattr(content.text, 'value'):
                                response_text = content.text.value
                                
                                # Check for annotations (files, citations)
                                if hasattr(content.text, 'annotations') and content.text.annotations:
                                    for annotation in content.text.annotations:
                                        attachments.append({
                                            "contentType": "annotation",
                                            "content": annotation,
                                            "name": getattr(annotation, 'text', 'Annotation')
                                        })
                        break
            
            # If no response was collected, use a default message
            if not response_text:
                response_text = "I received your message."
            
            # Process response for visualizations if visualization service is available
            if self.visualization_service and response_text:
                response_text = self.visualization_service.process_message_for_visualizations(response_text)
            
            return {
                "success": True,
                "response": response_text,
                "text": response_text,
                "attachments": attachments,
                "conversationId": conversation_id,
                "runId": run.id,
                "runStatus": run.status
            }
            
        except Exception as e:
            logger.error(f"Failed to send message to Azure AI Foundry: {e}")
            raise
    
    async def send_card_response(
        self,
        conversation_id: str,
        action_data: Dict,
        user_token: str,
        user_id: str
    ) -> Dict:
        """
        Send an Adaptive Card response to Azure AI Foundry.
        This converts the card action to a text message for the agent.
        
        Args:
            conversation_id: The thread ID from Azure AI Foundry
            action_data: The card action data (e.g., {"action": "Allow"})
            user_token: User's access token for OBO flow
            user_id: User identifier
            
        Returns:
            Dict containing response text, attachments, and activities
        """
        try:
            # Convert card action to text message
            action_text = f"User selected: {action_data.get('action', 'Unknown action')}"
            
            # Extract additional data from the card if present
            if 'data' in action_data:
                action_text += f"\nData: {action_data['data']}"
            
            # Send as a regular message
            return await self.send_message(
                conversation_id=conversation_id,
                message_text=action_text,
                user_token=user_token,
                user_id=user_id
            )
            
        except Exception as e:
            logger.error(f"Failed to send card response to Azure AI Foundry: {e}")
            raise
    
    async def get_conversation_messages(
        self,
        conversation_id: str,
        user_token: str,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get messages from a conversation thread.
        
        Args:
            conversation_id: The thread ID
            user_token: User's access token for OBO flow
            limit: Maximum number of messages to retrieve
            
        Returns:
            List of message dictionaries
        """
        try:
            # Get Azure AI token via OBO flow
            azure_ai_token = self._get_azure_ai_token(user_token)
            credential = TokenCredential(azure_ai_token)
            
            # Create AI Project Client with OBO token
            client = AIProjectClient(
                endpoint=self.ai_foundry_settings.endpoint,
                credential=credential
            )
            
            messages = await asyncio.to_thread(
                client.agents.messages.list,
                thread_id=conversation_id,
                limit=limit
            )
            
            message_list = []
            # messages is an ItemPaged iterator, iterate directly
            for message in messages:
                message_dict = {
                    "id": message.id,
                    "role": message.role,
                    "created_at": message.created_at,
                    "content": []
                }
                
                for content in message.content:
                    # Check if content has text attribute (duck typing)
                    if hasattr(content, 'text') and hasattr(content.text, 'value'):
                        message_dict["content"].append({
                            "type": "text",
                            "text": content.text.value
                        })
                
                message_list.append(message_dict)
            
            return message_list
            
        except Exception as e:
            logger.error(f"Failed to get conversation messages: {e}")
            raise
