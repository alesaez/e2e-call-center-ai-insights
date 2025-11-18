Absolutely, Alejandra—here’s a **complete, ready-to-paste GitHub Copilot prompt** that extends your containerization setup to **include Bicep (IaC) for Azure Container Apps (ACA)**. It’s structured to generate **separate Dockerfiles**, local **Docker Compose**, ACA deployment artifacts, and **Bicep modules** to provision all required Azure resources.

***

## 🧭 Final Prompt: Containerization + ACA Deployment + Bicep IaC

> Create a production-ready, full‑stack project setup for a **React frontend** and a **Python backend** (FastAPI or Flask) with the following:
>
> ### 1) Repository Structure
>
> *   A mono‑repo with these folders:
>     *   `/frontend` – React app with responsive UI + white‑label theming support
>     *   `/backend` – Python API (FastAPI/Flask) with endpoints for KPIs and chatbot routing
>     *   `/infra/bicep` – Bicep IaC for Azure resource provisioning
>     *   `/deploy` – ACA deployment specs and environment samples
>     *   `.github/workflows` – CI/CD for build, push, and deploy
>
> **Target architecture**:
>
> *   **Azure Container Apps** (ACA) for: `frontend`, `backend`, and (optionally) a dedicated `chatbot` container.
> *   **Azure Container Registry (ACR)** for images.
> *   **User‑Assigned Managed Identity** for ACA apps to pull secrets and ACR.
> *   **Azure Key Vault** for secrets (Entra client ID/tenant, Bot secrets, API keys).
> *   **Log Analytics + Application Insights** for monitoring.
> *   Optional: **VNet** and private ingress (parameterized).
>
> ***
>
> ### 2) Containerization (Separate Dockerfiles)
>
> **/frontend/Dockerfile**
>
> *   Multi‑stage build (Node 20+ for build → Nginx `alpine` for serve).
> *   Non‑root user, minimal attack surface, gzip/brotli enabled, cache‑busting, healthcheck.
> *   Runtime env injection (for ACA) for values like `REACT_APP_API_BASE_URL`, `REACT_APP_BRAND_NAME`, `REACT_APP_THEME_PRIMARY`.
>
> **/backend/Dockerfile**
>
> *   Python 3.12 `slim`, non‑root, `uvicorn`/`gunicorn` production config.
> *   Healthcheck endpoint (`/healthz`), proper timeouts, async worker settings.
> *   Dependencies for: Microsoft Entra validation (MSAL/pyjwt), KPI APIs, Bot Framework integration (Direct Line / Azure Bot Service), OpenAPI docs.
> *   Environment-based configuration via `pydantic`/`dynaconf`.
>
> **/docker-compose.yml (local dev)**
>
> *   Services: `frontend`, `backend`, optional `chatbot`.
> *   Local env overrides via `.env.development`.
> *   Volume mounts and hot‑reload enabled for dev.
>
> ***
>
> ### 3) ACA Deployment Specs
>
> *   `/deploy/aca-frontend.yaml`, `/deploy/aca-backend.yaml` (and optional `/deploy/aca-chatbot.yaml`) describing:
>     *   Container images from ACR, resource limits/requests.
>     *   Ingress rules: `frontend` external HTTPs with custom domain options; `backend` internal or external (param).
>     *   Environment variables (non‑secret), secret refs (from Key Vault/ACA secrets).
>     *   Liveness/readiness probes.
>     *   Autoscaling (KEDA): HTTP RPS, CPU %, and concurrency‑based rules.
>     *   (Optional) Dapr annotations for service discovery.
>
> Provide an example `deploy/env.sample.json` with placeholder values (API base URL, Tenant ID, Client ID, Bot settings).
>
> ***
>
> ### 4) Bicep IaC (Azure Resources)
>
> Generate modular Bicep under `/infra/bicep`:
>
> **Files**
>
> *   `main.bicep` – Orchestrates modules and outputs public endpoints.
> *   `modules/acr.bicep` – ACR with admin disabled, RBAC only.
> *   `modules/managedIdentity.bicep` – User‑Assigned Managed Identity for ACA apps.
> *   `modules/logging.bicep` – Log Analytics Workspace + Application Insights.
> *   `modules/keyvault.bicep` – Key Vault with access policies for the Managed Identity.
> *   `modules/acaEnv.bicep` – ACA Environment (Consumption/Workload Profile parameterized).
> *   `modules/containerApp.bicep` – Reusable module to deploy a Container App with:
>     *   Image, revision mode, scaling rules, env vars, secret refs, probes, ingress mode.
>     *   System or user‑assigned identity attachment.
> *   `modules/network.bicep` (optional) – VNet, subnet(s) for ACA env, private DNS.
> *   `parameters/dev.parameters.json` – Example parameter file.
>
> **Resources to deploy (parameterized where appropriate)**:
>
> *   Resource Group (if using subscription‑level deployment).
> *   ACR.
> *   Log Analytics + App Insights.
> *   Key Vault (+ access policy or RBAC for User‑Assigned MI).
> *   User‑Assigned Managed Identity (grant pull to ACR, get/list to Key Vault).
> *   ACA Environment.
> *   Container Apps:
>     *   `frontend`: external ingress, env vars for branding and API base URL.
>     *   `backend`: internal or external ingress (param), secrets for Entra authority/client ID, Bot secrets.
>     *   `chatbot` (optional): only if decoupled, with Bot secrets and Direct Line.
>
> **Notes**:
>
> *   **Do not place secrets in Bicep**. Use Key Vault secrets and ACA secrets section.
> *   **Microsoft Entra App Registration** is not created by Bicep—provide a separate script stub (README section) using **Microsoft Graph PowerShell/CLI** to register the app and place secrets into Key Vault.
>
> **Outputs**:
>
> *   Frontend FQDN/URL, Backend FQDN (if external), ACA Environment name, Key Vault name, ACR login server.
>
> ***
>
> ### 5) CI/CD (GitHub Actions)
>
> Create two workflows in `.github/workflows/`:
>
> **`build-and-deploy-containers.yml`**
>
> *   Triggers: `push` to `main`, manual `workflow_dispatch`.
> *   Jobs:
>     *   **Login to Azure** using OIDC (`azure/login@v2`).
>     *   **ACR login** (`az acr login`) with federated credentials.
>     *   **Build & push** images for `/frontend` and `/backend` with tags: `git-sha`, `latest`, and `env`.
>     *   **Update ACA revisions** using `az containerapp update` with new image tags and env substitutions.
>
> **`deploy-infra-bicep.yml`**
>
> *   Triggers: manual `workflow_dispatch` and optionally on infra folder changes.
> *   Jobs:
>     *   **Login to Azure** via OIDC.
>     *   **What‑If** and **Create/Update** deployment with `az deployment sub create` or `az deployment group create` (depending on template scope).
>     *   Parameters loaded from `infra/bicep/parameters/dev.parameters.json`.
>     *   Post‑deploy: write useful outputs to job summary (frontend URL, etc.).
>
> **Secrets/permissions**:
>
> *   Use **federated credentials** for the workflow (no static secrets).
> *   Grant workflow SPN access to deploy and push images.
>
> ***
>
> ### 6) Configuration & Environment
>
> Provide sample env files and document required variables:
>
> *   **Frontend (runtime)**
>     *   `REACT_APP_API_BASE_URL`
>     *   `REACT_APP_BRAND_NAME`, `REACT_APP_THEME_PRIMARY` (white labeling)
> *   **Backend (secret or env)**
>     *   `AUTH_TENANT_ID`, `AUTH_CLIENT_ID`, `AUTH_AUTHORITY_URL`
>     *   `BOT_DIRECTLINE_SECRET` or Bot Service credentials
>     *   `APPINSIGHTS_CONNECTION_STRING`
> *   **Shared**
>     *   `ENVIRONMENT`, `REGION`, `ACA_ENV_NAME`, `ACR_NAME`
>
> Document how ACA uses **secret refs** from Key Vault and how to rotate them.
>
> ***
>
> ### 7) Acceptance Criteria
>
> *   `docker-compose up` runs locally with hot‑reload and healthchecks.
> *   `az deployment …` creates ACR, Key Vault, MI, Log Analytics, App Insights, ACA Env, and Container Apps.
> *   CI builds and pushes images; ACA updates to new revisions with zero downtime.
> *   Frontend public URL responds; dashboard assets load; backend `/healthz` returns 200.
> *   No secrets in repo; Key Vault stores all sensitive values.
>
> ***
>
> ### 8) Documentation (README)
>
> *   Architecture diagram (ASCII or mermaid) and flow.
> *   How to provision infra (Bicep), set Key Vault secrets, then deploy containers.
> *   How to register Microsoft Entra App and Azure Bot resource (with PowerShell/CLI snippets) and store secrets in Key Vault.
> *   How to configure custom domain/SSL for frontend (ACA managed certs).
> *   Troubleshooting: image pull failures (ACR/MI), Key Vault RBAC, ingress issues, scaling.
>
> **Deliver all files scaffolded with comments and TODOs, plus a short walkthrough of commands to run end‑to‑end.**

***

### Pro tip (optional to include in the README)

If you want **Entra App Registration** and **Azure Bot Channels Registration** automated, add a separate script folder (`/scripts`) with **Microsoft Graph PowerShell** and **Azure CLI** scripts that:

*   Create the Entra app, expose scopes, and set redirect URIs.
*   Create/update Bot Channels Registration and set the messaging endpoint to the `backend` Container App.
*   Write client IDs/secrets to Key Vault.

***

If you’d like, I can also generate **parameter names and sample values** for `dev.parameters.json` to speed up your first deployment.
