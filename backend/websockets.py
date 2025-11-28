# simple_ws_server.py
import socket
import threading
import base64
import hashlib
import traceback

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

def _create_response_key(key):
    return base64.b64encode(hashlib.sha1(key + GUID).digest())

def _decode_frame(data):
    if len(data) < 2:
        return ""
    length = ord(data[1]) & 127
    mask_start = 2
    if length == 126:
        mask_start = 4
    elif length == 127:
        mask_start = 10

    mask = list(map(ord, data[mask_start:mask_start+4]))
    payload = data[mask_start+4:]
    decoded = ''.join(chr(ord(payload[i]) ^ mask[i % 4]) for i in range(len(payload)))
    return decoded

def _encode_frame(msg):
    msg = msg.encode('utf-8')
    length = len(msg)
    if length <= 125:
        header = chr(0x81) + chr(length)
    elif length <= 65535:
        header = chr(0x81) + chr(126) + chr((length >> 8) & 255) + chr(length & 255)
    else:
        header = chr(0x81) + chr(127)
        for shift in range(7, -1, -1):
            header += chr((length >> (shift * 8)) & 255)
    return header + msg


class WebsocketServer(object):
    def __init__(self, port, host='0.0.0.0'):
        self.port = port
        self.host = host
        self.clients = []
        self.next_id = 0

        self.fn_new_client = None
        self.fn_client_left = None
        self.fn_message_received = None

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(5)

    def set_fn_new_client(self, fn):
        self.fn_new_client = fn

    def set_fn_client_left(self, fn):
        self.fn_client_left = fn

    def set_fn_message_received(self, fn):
        self.fn_message_received = fn

    def _handshake(self, conn):
        data = conn.recv(1024)
        headers = {}
        for line in data.split("\r\n"):
            parts = line.split(": ", 1)
            if len(parts) == 2:
                headers[parts[0]] = parts[1]
        key = headers.get('Sec-WebSocket-Key')
        if not key:
            raise Exception("No Sec-WebSocket-Key header found")

        response_key = _create_response_key(key)
        response = (
            'HTTP/1.1 101 Switching Protocols\r\n'
            'Upgrade: websocket\r\n'
            'Connection: Upgrade\r\n'
            'Sec-WebSocket-Accept: %s\r\n\r\n' % response_key
        )
        conn.send(response)

    def _client_thread(self, conn, addr, client):
        try:
            self._handshake(conn)
            if self.fn_new_client:
                self.fn_new_client(client, self)
            while True:
                data = conn.recv(1024)
                if not data:
                    break
                msg = _decode_frame(data)
                if self.fn_message_received:
                    self.fn_message_received(client, self, msg)
        except Exception:
            traceback.print_exc()
        finally:
            conn.close()
            if self.fn_client_left:
                self.fn_client_left(client, self)
            self.clients.remove(client)

    def send_message(self, client, msg):
        try:
            client['conn'].send(_encode_frame(msg))
        except Exception:
            traceback.print_exc()

    def run_forever(self):
        print("WebSocket server running on %s:%d" % (self.host, self.port))
        while True:
            conn, addr = self.sock.accept()
            client = {"id": self.next_id, "handler": None, "conn": conn, "addr": addr}
            self.clients.append(client)
            self.next_id += 1
            t = threading.Thread(target=self._client_thread, args=(conn, addr, client))
            t.daemon = True
            t.start()

if __name__ == "__main__":

    def new_client(client, server):
        print("Client %d connected" % client["id"])
        server.send_message(client, "Welcome client %d!" % client["id"])

    def client_left(client, server):
        print("Client %d disconnected" % client["id"])

    def message_received(client, server, message):
        print("Client %d said: %s" % (client["id"], message))
        server.send_message(client, "Echo: " + message)

    ws = WebsocketServer(9001)

    ws.set_fn_new_client(new_client)
    ws.set_fn_client_left(client_left)
    ws.set_fn_message_received(message_received)

    ws.run_forever()
