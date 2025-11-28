const ws = new WebSocket("ws://127.0.0.1:9001")

ws.onopen = () => {
    ws.send("hello server")
}

ws.onmessage = msg => {
    console.log("FROM SERVER:", msg.data)
}
