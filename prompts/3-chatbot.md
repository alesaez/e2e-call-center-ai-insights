Add a Chatbot tab to a React web application using Microsoft Bot Framework.
Requirements:

- Integrate Bot Framework Web Chat into the React frontend.
- Chatbot tab name will be Copilot Studio Chat. USe CopilotStudio Client SDK: Microsoft.Agents.CopilotStudio.Client to interact with the Agent, in the app settings include the following settings to be able to interact with the SDK:
"CopilotStudioClientSettings": {
    "DirectConnectUrl": "",
    "EnvironmentId": "b770721c-e485-e866-bddd-e89fe5b9a701", 
    "SchemaName": "crb64_myAgent", 
    "TenantId": "211cfba1-9b0f-46aa-9e2d-478ed07f984e",
    "AppClientId": "bdc1d875-0789-4db3-bbe4-fdadbe7aaa8f",
    "AppClientSecret": ""
  }  
- Backend should support routing messages to the Bot Framework service.
- Include a Settings section where team or user-level query configurations can be edited via the portal.
- Editable queries should be stored securely and allow customization of chatbot behavior per user/team.
- Ensure chatbot UI is responsive and matches the application's white-label theme.
- Containerize the chatbot backend for deployment in Azure Container Apps (ACA).