"""
Copilot Studio service for agent interactions.
Handles session creation, message sending, and On-Behalf-Of authentication flow.
"""
from typing import Dict, List, Optional, AsyncGenerator
from microsoft_agents.activity import Activity, ActivityTypes, ConversationAccount, CardAction
from microsoft_agents.copilotstudio.client import ConnectionSettings, CopilotClient
from msal import ConfidentialClientApplication
from config import Settings
import logging

logger = logging.getLogger(__name__)


class CopilotStudioService:
    """Service for interacting with Copilot Studio agents."""
    
    def __init__(self, settings: Settings, visualization_service=None):
        """Initialize the Copilot Studio service."""
        if not settings.copilot_studio:
            raise ValueError("Copilot Studio settings not configured")
        
        self.settings = settings
        self.copilot_settings = settings.copilot_studio
        self.visualization_service = visualization_service
        
        # Reuse a single MSAL app to benefit from its internal token cache
        if self.copilot_settings.app_client_secret:
            self._msal_app = ConfidentialClientApplication(
                client_id=self.copilot_settings.app_client_id,
                client_credential=self.copilot_settings.app_client_secret,
                authority=f"https://login.microsoftonline.com/{self.copilot_settings.tenant_id}"
            )
        else:
            self._msal_app = None
        
        logger.info(f"✓ Copilot Studio service initialized: environment_id={self.copilot_settings.environment_id}")
    
    def _create_connection_settings(self) -> ConnectionSettings:
        """Create connection settings for Copilot Studio client."""
        return ConnectionSettings(
            environment_id=self.copilot_settings.environment_id,
            agent_identifier=self.copilot_settings.schema_name,
            cloud=None,
            copilot_agent_type=None,
            custom_power_platform_cloud=None,
        )
    
    async def _get_power_platform_token(self, user_token: str) -> str:
        """
        Get Power Platform token using On-Behalf-Of flow.
        The MSAL call is run in a thread to avoid blocking the event loop.
        
        Args:
            user_token: The user's JWT token from the frontend
            
        Returns:
            Access token for Power Platform API
            
        Raises:
            Exception: If token acquisition fails
        """
        if not self._msal_app:
            raise ValueError("Client secret not configured")
        
        import asyncio
        # Use the shared MSAL app (benefits from token cache)
        result = await asyncio.to_thread(
            self._msal_app.acquire_token_on_behalf_of,
            user_assertion=user_token,
            scopes=["https://api.powerplatform.com/.default"]
        )
        
        if "access_token" not in result:
            error_msg = result.get('error_description', result.get('error', 'Unknown error'))
            logger.error(f"Failed to acquire Power Platform token: {error_msg}")
            raise Exception(f"Failed to acquire token: {error_msg}")
        
        return result["access_token"]
    
    async def _create_client(self, user_token: Optional[str] = None) -> CopilotClient:
        """
        Create a Copilot Studio client instance.
        
        Args:
            user_token: Optional user JWT token for On-Behalf-Of flow
            
        Returns:
            Configured CopilotClient instance
        """
        connection_settings = self._create_connection_settings()
        
        if not user_token or not self.copilot_settings.app_client_secret:
            logger.warning("Creating Copilot client without token (no secret or user token)")
            return CopilotClient(connection_settings, None)
        
        # Get Power Platform token via On-Behalf-Of (now async)
        power_platform_token = await self._get_power_platform_token(user_token)
        return CopilotClient(connection_settings, power_platform_token)
    
    async def start_conversation(
        self, 
        user_token: str,
        user_id: str,
        user_name: str
    ) -> Dict:
        """
        Start a new conversation with Copilot Studio.
        
        Args:
            user_token: User's JWT token for On-Behalf-Of flow
            user_id: User identifier
            user_name: User display name
            
        Returns:
            Dict containing conversationId, welcomeMessage, and session details
        """
        try:
            client = await self._create_client(user_token)
            
            # Start conversation - returns an async generator
            welcome_message = ""
            conversation_id = None
            
            async for action in client.start_conversation(True):
                if action.text:
                    welcome_message = action.text
                if hasattr(action, 'conversation') and action.conversation:
                    conversation_id = action.conversation.id
            
            if not conversation_id:
                raise Exception("Failed to get conversation ID from Copilot Studio")
            
            return {
                "conversationId": conversation_id,
                "userId": user_id,
                "userName": user_name,
                "environmentId": self.copilot_settings.environment_id,
                "schemaName": self.copilot_settings.schema_name,
                "endpoint": f"https://{self.copilot_settings.environment_id}.api.powerplatform.com/v1.0/bots/{self.copilot_settings.schema_name}",
                "expiresIn": 3600,  # 1 hour
                "sessionCreated": True,
                "welcomeMessage": welcome_message
            }
            
        except Exception as e:
            logger.error(f"Failed to start Copilot Studio conversation: {e}")
            raise
    
    async def send_message(
        self,
        conversation_id: str,
        message_text: str,
        user_token: str,
        user_id: str
    ) -> Dict:
        """
        Send a message to Copilot Studio and receive response.
        
        Args:
            conversation_id: The conversation ID from Copilot Studio
            message_text: The message to send
            user_token: User's JWT token for On-Behalf-Of flow
            user_id: User identifier
            
        Returns:
            Dict containing response text, attachments, and activities
        """
        try:
            client = await self._create_client(user_token)
            
            response_text = ""
            attachments = []
            activities = []
            
            async for activity in client.ask_question(
                conversation_id=conversation_id,
                question=message_text
            ):
                activities.append(activity)
                            
                if activity.type == ActivityTypes.typing:
                    # logger.info(f"ACTIVITY [typing]: {activity.text}")
                    continue
                
                elif activity.type == ActivityTypes.event:
                    logger.info(f"ACTIVITY [event]: {activity.value}")
                    continue
                
                elif activity.type == ActivityTypes.message:
                    logger.info(f"ACTIVITY [message]: {activity.text}")
                    
                    # Extract text content
                    if activity.text:
                        response_text = activity.text
                    
                    # Extract attachments (including Adaptive Cards)
                    if hasattr(activity, 'attachments') and activity.attachments:
                        for attachment in activity.attachments:
                            attachments.append({
                                "contentType": attachment.content_type,
                                "content": attachment.content,
                                "name": getattr(attachment, 'name', None)
                            })
                else:
                    logger.info(f"ACTIVITY [unknown type={activity.type}]: {activity}")
            
            # If no response was collected, use a default message
            if not response_text and not attachments:
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
                "activities": [self._serialize_activity(a) for a in activities]
            }
            
        except Exception as e:
            logger.error(f"Failed to send message to Copilot Studio: {e}")
            raise
    
    async def send_card_response(
        self,
        conversation_id: str,
        action_data: Dict,
        user_token: str,
        user_id: str
    ) -> Dict:
        """
        Send an Adaptive Card response (InvokeResponse activity) to Copilot Studio.
        
        Args:
            conversation_id: The conversation ID from Copilot Studio
            action_data: The card action data (e.g., {"action": "Allow"})
            user_token: User's JWT token for On-Behalf-Of flow
            user_id: User identifier
            
        Returns:
            Dict containing response text, attachments, and activities
        """
        try:
            client = await self._create_client(user_token)
            
            # Create InvokeResponse activity
            invoke_activity = Activity(
                type=ActivityTypes.invoke_response,
                value=action_data
            )
            invoke_activity.conversation = ConversationAccount(id=conversation_id)
                        
            response_text = ""
            attachments = []
            activities = []
            
            # Try using ask_question_with_activity if available, otherwise fallback
            if hasattr(client, 'ask_question_with_activity'):
                logger.info("Using ask_question_with_activity method")
                async for activity in client.ask_question_with_activity(invoke_activity):
                    activities.append(activity)
                    
                    if activity.type == ActivityTypes.message:
                        if activity.text:
                            response_text = activity.text
                        
                        if hasattr(activity, 'attachments') and activity.attachments:
                            for attachment in activity.attachments:
                                attachments.append({
                                    "contentType": attachment.content_type,
                                    "content": attachment.content,
                                    "name": getattr(attachment, 'name', None)
                                })
            else:
                # Fallback: send as a regular message
                logger.info("Using fallback method (ask_question)")
                action_text = f"Card action: {action_data.get('action', 'submitted')}"
                async for activity in client.ask_question(
                    conversation_id=conversation_id,
                    question=action_text
                ):
                    activities.append(activity)
                    
                    if activity.type == ActivityTypes.message:
                        if activity.text:
                            response_text = activity.text
                        
                        if hasattr(activity, 'attachments') and activity.attachments:
                            for attachment in activity.attachments:
                                attachments.append({
                                    "contentType": attachment.content_type,
                                    "content": attachment.content,
                                    "name": getattr(attachment, 'name', None)
                                })
            
            if not response_text and not attachments:
                response_text = f"Card action '{action_data.get('action')}' processed."
            
            # Process response for visualizations if visualization service is available
            if self.visualization_service and response_text:
                response_text = self.visualization_service.process_message_for_visualizations(response_text)
            
            return {
                "success": True,
                "response": response_text,
                "text": response_text,
                "attachments": attachments,
                "conversationId": conversation_id,
                "activities": [self._serialize_activity(a) for a in activities]
            }
            
        except Exception as e:
            logger.error(f"Failed to send card response to Copilot Studio: {e}")
            raise
    
    def _serialize_activity(self, activity: Activity) -> Dict:
        """Serialize an Activity object to a dictionary for JSON response."""
        return {
            "type": activity.type,
            "id": getattr(activity, 'id', None),
            "text": activity.text,
            "timestamp": str(getattr(activity, 'timestamp', '')),
            "from": {
                "id": getattr(activity.from_property, 'id', None) if hasattr(activity, 'from_property') and activity.from_property else None,
                "name": getattr(activity.from_property, 'name', None) if hasattr(activity, 'from_property') and activity.from_property else None,
            } if hasattr(activity, 'from_property') else None,
            "channelData": getattr(activity, 'channel_data', None),
            "attachmentCount": len(activity.attachments) if hasattr(activity, 'attachments') and activity.attachments else 0
        }
