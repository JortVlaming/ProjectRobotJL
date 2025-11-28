# main.py
import threading

from websockets import WebsocketServer
import json
import qi

robots = {}

# Called for every client connecting (after handshake)
def new_client(client, server):
    print("New client connected and was given id %d" % client['id'])

# Called for every message received from a client
def message_received(client, server, message):
    try:
        data = json.loads(message)
    except ValueError:
        print("Invalid JSON command from client %d" % client['id'], message, "")
        server.send_message(client, json.dumps({"type": "error", "message": "Invalid JSON command"}))
        return
    print client["id"], data
    dtype = data["type"]
    if dtype == "connect":
        handleConnect(data, client, server)
    elif dtype == "method":
        handleMethod(data, client, server)

    return

def handleConnect(data, client, server):
    robot = data['robot']

    def connect(session, ip):
        session.connect("tcp://" + ip + ":9559")
        print "Connected to", robot
        server.send_message(client, json.dumps({"type": "connected"}))

    if robot not in robots:
        robots[robot] = {}
        robots[robot]["_session"] = qi.Session()
        robots[robot]["_thread"] = threading.Thread(
            target=connect,
            args=[robots[robot]["_session"], robot]
        )
        robots[robot]["_thread"].start()
    else:
        server.send_message(client, json.dumps({"type": "connected"}))


def handleMethod(data, client, server):
    robot = data['robot']
    service = str(data['service'])
    method = str(data['method'])
    args = data['args']

    if type(args) is not list:
        args = [args,]

    if robot not in robots:
        handleConnect({"robot": robot}, client, server)

    def unicodeToStr(arr):
        if arr is not list:
            return
        for i in range(len(arr)):
            if arr[i] is list:
                unicodeToStr(arr[i])
            elif arr[i] is str:
                arr[i] = str(arr[i])

    unicodeToStr(args)

    if service not in robots[robot]:
        try:
            robots[robot][service] = robots[robot]["_session"].service(service)
        except Exception as e:
            print(e)
            return

    # Call the method
    try:
        # print(args)
        robots[robot][service].call(str(method), *args)
    except Exception as e:
        print(e)
        server.send_message(
            client,
            json.dumps({"type": "error", "message": str(e)})
        )


# Called for client disconnecting
def client_left(client, server):
    if client is not None and 'id' in client:
        print("Client(%d) disconnected" % client['id'])
    else:
        print("Client disconnected (no valid client info)")

PORT = 9000

print("Attempting to start server on port %d" % PORT)

server = WebsocketServer(PORT, host='0.0.0.0')
server.set_fn_new_client(new_client)
server.set_fn_message_received(message_received)
server.set_fn_client_left(client_left)

print("WebSocket server started on port %d" % PORT)
server.run_forever()