<?php

?>

<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <link rel="stylesheet" href="css.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
    <title>Robot pagina</title>
</head>
<body class="bg-secondary p-3">
<h1>Welkom</h1>

<p>Welkom</p>

<form id="messageForm" action="http://100.102.215.58:3000/say" method="POST">
    <div class="mb-3 mt-3">
        <label for="messageForm" class="form-label">Send message to robot</label>
        <input type="text" class="form-control" id="messageInput" placeholder="Enter message" autocomplete="off">
    </div>
    <button type="submit" class="btn btn-primary">Submit</button>
</form>

<script>

const API_URL = location.hostname + ":3000"

// --- WebSocket setup ---
const socket = new WebSocket(`ws://${API_URL}/ws`);

// Wait until WebSocket is open
socket.addEventListener("open", () => {
  console.log("WebSocket connected");
});

// --- Gamepad polling ---
let previousButtons = {};
let wasMoving = false;

function pollGamepad() {
  const gamepads = navigator.getGamepads();
  const gp = gamepads[0]; // first connected gamepad

  if (gp) {
    // Check buttons (standard mapping):
    // Button 0: A/Cross, Button 1: B/Circle, Button 2: X/Square, Button 3: Y/Triangle
    const buttons = {
      a: gp.buttons[0]?.pressed || false,
      b: gp.buttons[1]?.pressed || false,
      x: gp.buttons[2]?.pressed || false,
      y: gp.buttons[3]?.pressed || false
    };

    console.log(JSON.stringify(buttons))

    // Detect button press events (was not pressed, now pressed)
    if (buttons.a && !previousButtons.a) {
      console.log("A button pressed");
      socket.send(JSON.stringify({
        type: "method",
          service: "ALRobotPosture",
          method: "goToPosture",
          args: ["StandInit", 1.0]
      }))
    }
    if (buttons.b && !previousButtons.b) {
      console.log("B button pressed");
      socket.send(JSON.stringify({
        type: "method",
          service: "ALRobotPosture",
          method: "goToPosture",
          args: ["Sitting", 1.0]
      }))
    }
    if (buttons.x && !previousButtons.x) {
      console.log("X button pressed");
      socket.send(JSON.stringify({
        type: "method",
          service: "ALRobotPosture",
          method: "goToPosture",
          args: ["LyingBack", 1.0]
      }))
    }
    if (buttons.y && !previousButtons.y) {
      console.log("Y button pressed");
      // Add your Y button logic here
    }

    previousButtons = buttons;

    // Most common layout:
    // Left Stick: axes[0] (x), axes[1] (y)
    // Right Stick: axes[2] (x), axes[3] (y)
    const payload = {
      leftStick: {
        x: (gp.axes[0] || 0),
        y: gp.axes[1] || 0,
      },
      rightStick: {
        x: gp.axes[2] || 0,
        y: gp.axes[3] || 0,
      }
    };

    const movement = [
            Math.abs(payload.leftStick.y) > 0.1 ? -payload.leftStick.y : 0,
            Math.abs(payload.leftStick.x) > 0.1 ? -payload.leftStick.x : 0,
            Math.abs(payload.rightStick.x) > 0.1 ? -payload.rightStick.x : 0]

    if (movement[0] !== 0 || movement[1] !== 0 || movement[2] !== 0) {
      console.log(payload, JSON.stringify(movement))

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "method",
          service: "ALMotion",
          method: "move",
          args: movement
        }));
      }
    } else {
        if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "method",
          service: "ALMotion",
          method: "stopMove"
        }));
      }
    }
  }

  requestAnimationFrame(pollGamepad);
}

// Start when a gamepad connects
window.addEventListener("gamepadconnected", () => {
  console.log("Gamepad connected");
  pollGamepad();
});

document.getElementById("messageForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const message = document.getElementById("messageInput").value;

    fetch(`http://${API_URL}/say`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({message: message})
    })
})

</script>

</body>
</html>
