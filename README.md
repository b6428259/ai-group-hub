# AI Group Hub 🤖💼

A premium, modern, multi-agent corporate collaboration hub running on top of **OpenClaw** and **SUT GenAI**. 
The system delegates complex tasks through a realistic corporate hierarchy (**Secretary ➔ CEO ➔ CTO ➔ PM ➔ Subordinate Specialists ➔ QA**) and executes independent tasks in **parallel** using a custom **DAG Scheduler**.

This project is split into a separate architecture:
- **Frontend App**: Deployed as a static React application on **Vercel**.
- **Backend API**: Deployed as a standalone Node.js Express server on your **ION Server** (`100.96.8.110`).

---

## 🛠️ 1. Standalone Backend Setup (ION Server)

The backend runs an Express API on the ION Server to route OpenClaw CLI commands and direct HTTP inferences.

### Prerequisites
*   Node.js (v18+)
*   OpenClaw CLI installed and authenticated on the server.

### Installation
1.  Copy the code repository to your **ION Server**.
2.  Install the required backend dependencies:
    ```bash
    npm install
    ```
3.  Set your SUT API key as an environment variable (or let it auto-resolve from OpenClaw's local `models.json` file):
    ```bash
    # Linux / macOS
    export SUT_OPENWEBUI_API_KEY="sk-your-key-here"
    
    # Windows PowerShell
    $env:SUT_OPENWEBUI_API_KEY="sk-your-key-here"
    ```
4.  Start the Express server:
    ```bash
    npm start
    ```
    The server will start on port `3000` (configurable via `PORT` environment variable) and listen on all network interfaces (`0.0.0.0`), with CORS fully enabled.

5.  *(Optional)* Manage the process in the background using PM2:
    ```bash
    npm install -g pm2
    pm2 start server.js --name "ai-group-backend"
    ```

---

## 🚀 2. Frontend Deployment (Vercel)

The frontend is a React + Vite application. You can deploy it to Vercel in seconds using the Vercel CLI.

### Installation & Deployment
1.  Ensure you have the Vercel CLI installed:
    ```bash
    npm install -g vercel
    ```
2.  Log in to your Vercel account:
    ```bash
    vercel login
    ```
3.  Deploy the project:
    ```bash
    vercel
    ```
    *   Set the **Output Directory** to `dist` if prompted.
    *   Set the **Environment Variable** `VITE_API_URL` to point to your ION Server:
        *   **Name**: `VITE_API_URL`
        *   **Value**: `http://100.96.8.110:3000`
4.  To deploy to production:
    ```bash
    vercel --prod
    ```

---

## 🧭 3. API Endpoints Reference

*   `GET /api/models` — Runs the local `openclaw models list --json` CLI command and returns active models.
*   `POST /api/infer` — Executes LLM completions using direct HTTP fetch to `https://genai.sut.ac.th/api/chat/completions` (bypassing Windows character limits).
