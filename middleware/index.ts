// index.ts
const ROBOT = "192.168.2.186";

// --------------------------------------
// CONFIG
// --------------------------------------
const WS_URL = "ws://100.102.215.58:9000";
const DEBUG = true;                         // << ENABLE DEBUG MODE HERE
const RECONNECT_BASE = 1000;                 // 1s
const RECONNECT_MAX = 8000;                  // 8s max
let reconnectDelay = RECONNECT_BASE;

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
    fetch: async (req) => {
        if (req.method === "OPTIONS") {
            return addCors(new Response(null, { status: 204 }), req);
        }

        const pathname = new URL(req.url).pathname;

        if (req.method === "POST" && pathname === "/say") {
            const data = JSON.parse(await req.text());

            if (!data?.message) {
                return new Response("Bad Request", { status: 400 });
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
