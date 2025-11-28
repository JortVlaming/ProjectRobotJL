const ROBOT = "192.168.2.186";

const ws = new WebSocket("ws://100.102.215.58:9000")

ws.onopen = () => {
    ws.send(JSON.stringify({
        type: "connect",
        robot: ROBOT
    }))
}

export function addCors(response: Response, req?: Request): Response {
    const headers = new Headers(response.headers);

    // For security, echo the Origin header when present instead of using '*'
    headers.set("Access-Control-Allow-Origin", "*");

    // Allow credentials if the client sent cookies/auth headers
    headers.set("Access-Control-Allow-Credentials", "true");

    // Allowed methods and headers
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    // If the request had Access-Control-Request-Headers (preflight), echo them back
    const reqHeaders = req?.headers.get("access-control-request-headers");
    headers.set("Access-Control-Allow-Headers", reqHeaders ?? "*");

    // Expose common headers to the browser
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
    fetch: async (req): Promise<Response> => {
        if (req.method === "OPTIONS") {
            return addCors(new Response(null, { status: 204 }), req);
        }

        const pathname = new URL(req.url).pathname;

        if (req.method === "POST" && pathname === "/say") {
            const data = JSON.parse(await req.text());
            if (!data || !data["message"]) {
                return new Response("Bad Request", { status: 400 })
            }
            ws.send(JSON.stringify({
                type: "method",
                robot: ROBOT,
                service: "ALTextToSpeech",
                method: "say",
                args: [data["message"]]
            }))
        }

        return new Response("OK", { status: 404 });
    }
});

process.on("SIGINT", () => {
    server.stop()
})

process.on("SIGTERM", () => {
    server.stop(true)
})