// index.ts
const ROBOT = "192.168.2.198";

// --------------------------------------
// CONFIG
// --------------------------------------
const WS_URL = "ws://100.102.215.58:9000";
const DEBUG = false;                         // << ENABLE DEBUG MODE HERE
const RECONNECT_BASE = 1000;                 // 1s
const RECONNECT_MAX = 8000;                  // 8s max
let reconnectDelay = RECONNECT_BASE;
let clientSockets = new Set<any>();

// --------------------------------------
// WebSocket wrapper with auto-reconnect
// --------------------------------------
let ws: WebSocket | null = null;
let kill = false;

function log(...args: any[]) {
    console.log("[WS]", ...args);
}

// Debug mode → replace ws logic with no-op stub
if (DEBUG) {
    log("DEBUG MODE ENABLED – no websocket connection will be made.");

    ws = {
        readyState: 1,
        send: (msg: any) => log("(debug) send →", msg),
        close: () => log("(debug) close"),
    } as any;
} else {
    connect();
}

function connect() {
    log("Connecting to", WS_URL);
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        log("Connected");
        reconnectDelay = RECONNECT_BASE; // reset backoff

        ws?.send(JSON.stringify({
            type: "connect",
            robot: ROBOT
        }));
    };

    ws.onmessage = (msg) => {
        log("Message:", msg.data);
        // Broadcast to all connected client WebSockets
        clientSockets.forEach(client => {
            if (client.readyState === 1) {
                client.send(msg.data);
            }
        });
    };

    ws.onerror = (err: Event) => {
        log("Socket error:", err);
    };

    ws.onclose = () => {
        if (kill) return;

        log("Disconnected. Reconnecting in", reconnectDelay, "ms...");
        setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
            connect();
        }, reconnectDelay);
    };
}

// --------------------------------------
// Helper for sending WS messages safely
// --------------------------------------
function sendWS(data: any) {
    const payload = JSON.stringify(data);

    if (DEBUG) {
        log("(debug) send →", payload);
        return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log("WS not open. Dropping message:", payload);
        return;
    }

    ws.send(payload);
}

// --------------------------------------
// HTTP Server
// --------------------------------------
function addCors(response: Response, req?: Request) {
    const headers = new Headers(response.headers);

    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    const reqHeaders = req?.headers.get("access-control-request-headers");
    headers.set("Access-Control-Allow-Headers", reqHeaders ?? "*");

    headers.set("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Type");

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

const server = Bun.serve({
    port: 3000,
    hostname: "0.0.0.0",
    fetch: async (req, server) => {
        if (req.method === "OPTIONS") {
            return addCors(new Response(null, { status: 204 }), req);
        }

        const pathname = new URL(req.url).pathname;

        // WebSocket upgrade
        if (pathname === "/ws") {
            const upgraded = server.upgrade(req);
            if (upgraded) {
                return undefined;
            }
            return new Response("WebSocket upgrade failed", { status: 400 });
        }

        if (req.method === "POST" && pathname === "/say") {
            let data;
            
            const contentType = req.headers.get("content-type");
            if (contentType?.includes("application/x-www-form-urlencoded")) {
                const formData = await req.formData();
                data = {
                    message: formData.get("message"),
                    volume: formData.get("volume") ? parseFloat(formData.get("volume") as string) : undefined
                };
            } else {
                data = JSON.parse(await req.text());
            }

            if (!data?.message) {
                return new Response("Bad Request", { status: 400 });
            }

            if (data.volume && typeof data.volume === "number") {
                sendWS({
                    type: "method",
                    robot: ROBOT,
                    service: "ALTextToSpeech",
                    method: "setVolume",
                    args: [data.volume]
                });
                // Small delay to ensure messages don't get concatenated
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            sendWS({
                type: "method",
                robot: ROBOT,
                service: "ALTextToSpeech",
                method: "say",
                args: [data.message]
            });

            return addCors(new Response("OK"), req);
        }

        return addCors(new Response("Not Found", { status: 404 }), req);
    },
    websocket: {
        open(ws) {
            clientSockets.add(ws);
            log("Client WebSocket connected. Total clients:", clientSockets.size);
        },
        message(ws, message) {
            // Forward client messages to backend
            const msg = typeof message === 'string' ? message : new TextDecoder().decode(message);
            log("Client message:", msg);
            const data = JSON.parse(msg);
            data["robot"] = ROBOT
            sendWS(data);
        },
        close(ws) {
            clientSockets.delete(ws);
            log("Client WebSocket disconnected. Total clients:", clientSockets.size);
        }
    }
});

// --------------------------------------
// Shutdown handlers
// --------------------------------------
process.on("SIGINT", () => {
    kill = true;
    log("SIGINT received. Stopping server...");
    server.stop();
    try { ws?.close(); } catch {}
});

process.on("SIGTERM", () => {
    kill = true;
    log("SIGTERM received. Stopping server...");
    server.stop(true);
    try { ws?.close(); } catch {}
});
