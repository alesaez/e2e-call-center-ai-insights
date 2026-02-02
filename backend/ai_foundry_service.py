"""
Azure AI Foundry service for agent interactions.
Handles session creation, message sending, and agent interactions using Azure AI Projects.
Uses MSAL On-Behalf-Of (OBO) flow for authentication.
"""
from typing import Dict, List, Optional, Any
import msal
from azure.core.credentials import AccessToken
from azure.ai.projects import AIProjectClient
from openai import AzureOpenAI
from config import Settings
import logging
import asyncio
import json

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
            
            try:
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
            finally:
                # Close the client to cleanup aiohttp session
                await asyncio.to_thread(client.close)
            
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
            
            try:
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
                
                # Generate follow-up questions based on conversation history
                suggested_questions = []
                try:
                    # Build conversation history from recent messages
                    conversation_history = [
                        {"role": "user", "content": message_text},
                        {"role": "assistant", "content": response_text}
                    ]
                    # Get recent messages for better context (optional, for richer suggestions)
                    try:
                        # Get latest 6 messages from the current conversation from Cosmos
                        
                        recent_messages = await self.get_conversation_messages(
                            conversation_id=conversation_id,
                            user_token=user_token,
                            limit=6
                        )

                        # Convert to simpler format and reverse (oldest first)
                        for msg in reversed(recent_messages[2:]):  # Skip the two we just added
                            if msg.get("content"):
                                conversation_history.insert(0, {
                                    "role": msg["role"],
                                    "content": msg["content"][0].get("text", "") if msg["content"] else ""
                                })
                    except Exception as e:
                        logger.debug(f"Could not retrieve full conversation history: {e}")
                    
                    # Generate questions
                    suggested_questions = await self.generate_follow_up_questions(
                        conversation_history=conversation_history,
                        user_token=user_token,
                        max_questions=3
                    )
                except Exception as e:
                    logger.warning(f"Failed to generate follow-up questions: {e}")
                    # Continue without suggestions
                
                return {
                    "success": True,
                    "response": response_text,
                    "text": response_text,
                    "attachments": attachments,
                    "conversationId": conversation_id,
                    "runId": run.id,
                    "runStatus": run.status,
                    "suggestedQuestions": suggested_questions  # Add AI-generated suggestions
                }
            finally:
                # Close the client to cleanup aiohttp session
                await asyncio.to_thread(client.close)
            
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
    
    async def generate_follow_up_questions(
        self,
        conversation_history: List[Dict],
        user_token: str,
        max_questions: int = 5
    ) -> List[str]:
        """
        Generate contextual follow-up questions using Azure OpenAI.
        
        Args:
            conversation_history: Recent messages from the conversation (list of {role, content} dicts)
            user_token: User's access token for OBO flow
            max_questions: Maximum number of questions to generate (default: 5)
            
        Returns:
            List of 3-5 suggested follow-up questions
        """
        try:
            # Check if question suggestions are enabled
            if not self.ai_foundry_settings.enable_question_suggestions:
                logger.debug("Question suggestions disabled in configuration")
                return []
            
            # Check if OpenAI endpoint is configured
            if not self.ai_foundry_settings.openai_endpoint:
                logger.debug("OpenAI endpoint not configured, skipping question generation")
                return []
            
            # Get Azure AI token via OBO flow
            azure_ai_token = self._get_azure_ai_token(user_token)
            
            # Create Azure OpenAI client
            openai_client = AzureOpenAI(
                azure_endpoint=self.ai_foundry_settings.openai_endpoint,
                api_key=azure_ai_token,
                api_version=self.ai_foundry_settings.openai_api_version
            )
            
            # Prepare conversation history for the prompt (last 6 messages)
            recent_messages = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history
            
            # Build the system prompt for question generation
            system_prompt = f"""You are a helpful assistant that suggests relevant follow-up questions based on an ongoing conversation between a user and an AI assistant.
Using the provided conversation history ordered newest-to-oldest (the first message is the most recent, including the last assistant response), generate {max_questions} short, relevant questions that the user might logically ask next.
Priority Rule (Critical):
- First, inspect the last assistant message for any explicit or implied follow-up suggestions (e.g., requests for charts, deeper analysis, comparisons, or strategies).
- Convert those suggestions into user-phrased questions and prioritize them in the output.
- If additional questions are needed, infer them from the broader conversation context.

Focus on:
- Key metrics or measures discussed
- Performance, quality, or effectiveness of entities involved
- Insights, rankings, patterns, or trends implied
- Comparisons, breakdowns, or deeper exploration
- Visualization opportunities and data gaps
- Actionable next steps or recommendations

Guidelines:
- Keep questions concise (5-12 words)
- Ensure questions are specific, relevant, and actionable
- Vary question types (metrics, comparisons, trends, clarifications, next actions)
- Infer domain and terminology from context; do not assume a fixed use case
- Avoid repeating questions already answered
- Prioritize questions that naturally advance the conversation

Output Requirements:
- Return ONLY a JSON array of question strings
- No explanations, headings, or additional text

Example Output:
["What is the average call duration?", "Show me agent performance trends", "Which issues cause the most customer complaints?"]"""
            
            # Build conversation context
            conversation_context = "\n".join([
                f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}"
                for msg in recent_messages
            ])
            
            user_prompt = f"""Based on this conversation:

{conversation_context}

Generate {max_questions} relevant follow-up questions as a JSON array."""
            
            # Call Azure OpenAI for question generation
            response = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model=self.ai_foundry_settings.openai_deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=300,
                response_format={"type": "json_object"}
            )
            
            # Parse the response
            content = response.choices[0].message.content
            
            # Try to parse as JSON
            try:
                # Handle both array format and object format
                parsed = json.loads(content)
                
                if isinstance(parsed, list):
                    questions = parsed
                elif isinstance(parsed, dict):
                    # Try common keys
                    questions = parsed.get('questions', parsed.get('suggestions', parsed.get('followup', [])))
                else:
                    questions = []
                
                # Ensure we have strings and limit to max_questions
                questions = [str(q).strip() for q in questions if q][:max_questions]
                
                logger.info(f"Generated {len(questions)} follow-up questions using Azure OpenAI")
                return questions
                
            except json.JSONDecodeError as je:
                logger.warning(f"Failed to parse OpenAI response as JSON: {je}")
                # Try to extract questions from text if JSON parsing fails
                lines = content.strip().split('\n')
                questions = [line.strip(' -"[]') for line in lines if line.strip()][:max_questions]
                return questions
                
        except Exception as e:
            logger.error(f"Failed to generate follow-up questions: {e}")
            # Return empty list on error - graceful degradation
            return []
    
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
            
            try:
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
            finally:
                # Close the client to cleanup aiohttp session
                await asyncio.to_thread(client.close)
            
        except Exception as e:
            logger.error(f"Failed to get conversation messages: {e}")
            raise

    async def generate_conversation_title(
        self,
        user_token: str,
        first_message: str,
        max_length: int = 50
    ) -> str:
        """
        Generate a concise, descriptive title for a conversation using Azure OpenAI.
        
        Args:
            user_token: The user's access token for OBO flow
            first_message: The first message in the conversation
            max_length: Maximum length of the generated title
            
        Returns:
            A concise title for the conversation, or the truncated first message if generation fails
        """
        # Fallback title in case of any issues
        fallback_title = first_message[:max_length] + ('...' if len(first_message) > max_length else '')
        
        try:
            # Check if OpenAI endpoint is configured
            if not self.ai_foundry_settings.openai_endpoint:
                logger.debug("OpenAI endpoint not configured, using fallback title")
                return fallback_title
            
            # Get Azure AI token via OBO flow
            azure_ai_token = self._get_azure_ai_token(user_token)
            
            # Create Azure OpenAI client
            openai_client = AzureOpenAI(
                azure_endpoint=self.ai_foundry_settings.openai_endpoint,
                api_key=azure_ai_token,
                api_version=self.ai_foundry_settings.openai_api_version
            )
            
            # Build the prompt for title generation
            system_prompt = """You are a helpful assistant that generates concise, descriptive titles for chat conversations.
Given the user's first message, create a short title (3-8 words) that captures the main topic or intent.

Guidelines:
- Keep it brief and descriptive
- Focus on the main subject or question
- Use title case
- Don't include quotes or special characters
- Make it suitable for a conversation list display

Return ONLY the title text, nothing else."""
            
            user_prompt = f"""Generate a concise title for a conversation that starts with this message:

"{first_message}"

Title:"""
            
            # Call Azure OpenAI for title generation
            response = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model=self.ai_foundry_settings.openai_deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent titles
                max_tokens=50
            )
            
            # Extract the generated title
            generated_title = response.choices[0].message.content.strip()
            
            # Remove any quotes that might be in the response
            generated_title = generated_title.strip('"\'')
            
            # Ensure it's not too long
            if len(generated_title) > max_length:
                generated_title = generated_title[:max_length-3] + '...'
            
            # Validate we got something meaningful
            if generated_title and len(generated_title) > 2:
                logger.info(f"Generated conversation title: {generated_title}")
                return generated_title
            else:
                logger.warning("Generated title was empty or too short, using fallback")
                return fallback_title
                
        except Exception as e:
            logger.warning(f"Failed to generate conversation title: {e}. Using fallback.")
            return fallback_title
