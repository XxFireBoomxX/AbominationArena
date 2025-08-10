# client/client.py
import socketio

sio = socketio.Client()

@sio.event
def connect():
    print("✅ Свързан си към AbominationArena сървъра!")

    username = input("🧑 Въведи име: ")
    choice = input("💀 Избери: [1] Създай стая | [2] Присъедини се към стая\n> ")

    if choice == "1":
        sio.emit('create_room', {'username': username})
    elif choice == "2":
        room_id = input("🔑 Въведи room ID: ")
        sio.emit('join_room', {'room_id': room_id, 'username': username})
    else:
        print("🤡 Невалиден избор.")
        sio.disconnect()

@sio.event
def disconnect():
    print("❌ Изключен си от сървъра.")

@sio.on('room_created')
def on_room_created(data):
    print(f"🛠️ Стая създадена успешно! Room ID: {data['room_id']}")
    print("⏳ Изчакай втори играч...")

@sio.on('room_joined')
def on_room_joined(data):
    print(f"🎮 Присъедини се към стая: {data['room_id']}")

@sio.on('both_ready')
def on_both_ready(data):
    print("⚔️ Двамата играчи са готови! Ето ги:")
    for name in data['players']:
        print(f" - {name}")
    print("🔥 Арената започва! (време е за логика за бой...)")

@sio.on('player_left')
def on_player_left(data):
    print(f"👤 {data['username']} напусна стаята. Играта е прекратена.")

@sio.on('error')
def on_error(data):
    print(f"💥 Грешка: {data['message']}")

if __name__ == "__main__":
    try:
        sio.connect('http://localhost:5000')
        sio.wait()
    except Exception as e:
        print("💔 Неуспешна връзка със сървъра:", e)
