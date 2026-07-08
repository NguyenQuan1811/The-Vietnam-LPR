// API configuration for the LPR frontend

// HTTP API base — proxied through Next.js rewrites (for lightweight requests)
const API_BASE = '/api/v1';

// Direct backend URL — used for file uploads and large requests
// Next.js proxy has a 10MB body limit, so large files must bypass it
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000/api/v1';

// WebSocket base — connects directly to FastAPI backend
// Next.js rewrites do NOT support WebSocket upgrade, so we must bypass the proxy
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/api/v1/ws/lpr';

export { API_BASE, BACKEND_URL, WS_URL };
