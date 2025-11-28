# main.py
import threading
import json
import qi

from websockets import WebsocketServer

robots = {}


# ------------------------------------------------------------
# Client event callbacks
# ------------------------------------------------------------

def new_client(client, server):
    print("New client connected and was given id %d" % client['id'])


def client_left(client, server):
    if client and 'id' in client:
        print("Client(%d) disconnected" % client['id'])
    else:
        print("Client disconnected (no valid client info)")


# ------------------------------------------------------------
# Message handling
# ------------------------------------------------------------

def message_received(client, server, message):
    try:
        data = json.loads(message)
    except ValueError:
        print("Invalid JSON command from client %d: %s" % (client['id'], message))
        server.send_message(client, json.dumps({"type": "error", "message": "Invalid JSON command"}))
        return

    dtype = data.get("type")
    if dtype == "connect":
        handle_connect(data, client, server)
    elif dtype == "method":
        handle_method(data, client, server)
    else:
        print("Unknown message type from client %d: %s" % (client['id'], dtype))


# ------------------------------------------------------------
# Connect to robot
# ------------------------------------------------------------

def handle_connect(data, client, server):
    robot = data['robot']

    def connect(session, ip):
        try:
            session.connect("tcp://" + ip + ":9559")
            print("Connected to %s" % robot)
            server.send_message(client, json.dumps({"type": "connected"}))
        except Exception as e:
            print("Connection failed:", e)
            server.send_message(client, json.dumps({"type": "error", "message": str(e)}))

    if robot not in robots:
        robots[robot] = {
            "_session": qi.Session(),
        }
        robots[robot]["_thread"] = threading.Thread(
            target=connect,
            args=(robots[robot]["_session"], robot)
        )
        robots[robot]["_thread"].start()
    else:
        server.send_message(client, json.dumps({"type": "connected"}))


# ------------------------------------------------------------
# Call robot method
# ------------------------------------------------------------

def handle_method(data, client, server):
    robot = data['robot']
    service = str(data['service'])
    method = str(data['method'])
    args = data.get('args', [])

    # Normalize args to a list
    if not isinstance(args, list):
        args = [args]

    # Ensure robot session exists
    if robot not in robots:
        handle_connect({"robot": robot}, client, server)

    # Ensure args are simple Python strings
    def normalize(arg_list):
        if not isinstance(arg_list, list):
            return
        for i in range(len(arg_list)):
            if isinstance(arg_list[i], list):
                normalize(arg_list[i])
            elif isinstance(arg_list[i], unicode):
                arg_list[i] = str(arg_list[i])

    normalize(args)

    # Get service instance if needed
    if service not in robots[robot]:
        try:
            robots[robot][service] = robots[robot]["_session"].service(service)
        except Exception as e:
            print("Service load error:", e)
            server.send_message(client, json.dumps({"type": "error", "message": str(e)}))
            return

    try:
        robots[robot][service].call(method, *args)
    except Exception as e:
        print("Method call error:", e)
        server.send_message(client, json.dumps({"type": "error", "message": str(e)}))


# ------------------------------------------------------------
# Server startup
# ------------------------------------------------------------

PORT = 9000

print("Attempting to start server on port %d" % PORT)

server = WebsocketServer(PORT, host='0.0.0.0')
server.set_fn_new_client(new_client)
server.set_fn_message_received(message_received)
server.set_fn_client_left(client_left)

print("WebSocket server started on port %d" % PORT)
server.run_forever()
