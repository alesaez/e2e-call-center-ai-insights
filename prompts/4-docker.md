Create separate Dockerfiles for a full-stack web application with a React frontend and a Python backend (using FastAPI or Flask).
Requirements:
- The frontend Dockerfile should:
  - Build and serve the React app using a production-ready server (e.g., Nginx or serve).
  - Include environment variable support for API endpoints and branding (white labeling).
  - Be optimized for ACA deployment.
- The backend Dockerfile should:
  - Use Python with FastAPI or Flask.
  - Include dependencies for Microsoft Entra SSO, Bot Framework integration, and KPI APIs.
  - Expose necessary ports and support environment-based configuration.
  - Be production-ready and ACA-compatible.
- Provide a sample docker-compose.yml for local development.
- Include ACA-specific deployment configuration files (e.g., aca.yaml, resource definitions, ingress settings).
- Ensure both containers can communicate securely and scale independently.