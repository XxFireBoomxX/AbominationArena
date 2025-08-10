# client/game.py

import pygame
import socketio
import threading

WIDTH, HEIGHT = 800, 600
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 50, 50)
BLUE = (50, 150, 255)

PLAYER_RADIUS = 20
BULLET_RADIUS = 5

sio = socketio.Client()
game_state = {'players': {}, 'bullets': []}
player_sid = None

pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("AbominationArena")
clock = pygame.time.Clock()

@sio.event
def connect():
    print("✅ Свързан си към сървъра!")

@sio.event
def disconnect():
    print("❌ Изключен си от сървъра.")

@sio.on('update_state')
def on_update_state(data):
    global game_state
    game_state = data

def network_loop():
    sio.connect('http://localhost:5000')
    sio.wait()

def draw():
    screen.fill(BLACK)

    # Играчите
    for sid, p in game_state['players'].items():
        color = RED if sid != player_sid else BLUE
        pygame.draw.circle(screen, color, (int(p['x']), int(p['y'])), PLAYER_RADIUS)
        hp_text = pygame.font.SysFont(None, 24).render(f"{p['hp']} HP", True, WHITE)
        screen.blit(hp_text, (p['x'] - 20, p['y'] - 35))

    # Патронки
    for b in game_state['bullets']:
        pygame.draw.circle(screen, WHITE, (int(b['x']), int(b['y'])), BULLET_RADIUS)

    pygame.display.flip()

def main():
    global player_sid

    net_thread = threading.Thread(target=network_loop)
    net_thread.daemon = True
    net_thread.start()

    running = True
    move_left = False
    move_right = False

    while running:
        clock.tick(60)
        keys = pygame.key.get_pressed()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT:
                    move_left = True
                elif event.key == pygame.K_RIGHT:
                    move_right = True
                elif event.key == pygame.K_SPACE:
                    sio.emit('shoot')

            if event.type == pygame.KEYUP:
                if event.key == pygame.K_LEFT:
                    move_left = False
                elif event.key == pygame.K_RIGHT:
                    move_right = False

        # Изпращане на движение
        if move_left:
            sio.emit('move', {'dir': -1})
        elif move_right:
            sio.emit('move', {'dir': 1})

        # Вземи SID-то на този клиент
        if not player_sid and 'players' in game_state:
            for sid in game_state['players']:
                if sid == sio.sid:
                    player_sid = sid


        draw()

    pygame.quit()

if __name__ == '__main__':
    main()
