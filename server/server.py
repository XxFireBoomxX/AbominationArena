from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import uuid
import threading
import time
from game_state import GameState

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

rooms = {}  # room_id -> {players: [sid1, sid2], names: {sid: name}}
game = GameState()

@app.route('/')
def index():
    return "AbominationArena server is running."

@socketio.on('connect')
def on_connect():
    print("🔌 Играч се свърза!")
    game.add_player(request.sid)

@socketio.on('disconnect')
def on_disconnect():
    for room_id, data in rooms.items():
        if request.sid in data['players']:
            data['players'].remove(request.sid)
            username = data['names'].pop(request.sid, 'НЯКОЙ')
            emit('player_left', {'username': username}, room=room_id)
            print(f"🚪 {username} напусна стая: {room_id}")
            break
    game.remove_player(request.sid)

@socketio.on('create_room')
def handle_create_room(data):
    username = data['username']
    room_id = str(uuid.uuid4())[:6]

    join_room(room_id)
    rooms[room_id] = {
        'players': [request.sid],
        'names': {request.sid: username}
    }

    emit('room_created', {'room_id': room_id})
    print(f"🛠️ {username} създаде стая: {room_id}")

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data['room_id']
    username = data['username']

    if room_id in rooms and len(rooms[room_id]['players']) < 2:
        join_room(room_id)
        rooms[room_id]['players'].append(request.sid)
        rooms[room_id]['names'][request.sid] = username

        emit('room_joined', {'room_id': room_id}, room=request.sid)
        emit('both_ready', {
            'players': list(rooms[room_id]['names'].values())
        }, room=room_id)

        print(f"🎮 {username} се включи в стая: {room_id}")
    else:
        emit('error', {'message': 'Room not found or full'})
        print(f"❌ Опит за влизане в стая {room_id} — неуспешен!")

@socketio.on('move')
def on_move(data):
    direction = data.get('dir')  # -1 or 1
    game.move_player(request.sid, direction)

@socketio.on('shoot')
def on_shoot():
    game.shoot(request.sid)

def game_loop():
    while True:
        game.update()
        socketio.emit('update_state', game.get_state())
        time.sleep(0.05)

threading.Thread(target=game_loop, daemon=True).start()

if __name__ == '__main__':
    print("🟢 AbominationArena сървърът стартира на http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000)
