# server/game_state.py
import time

class GameState:
    def __init__(self):
        self.players = {}  # sid -> {x, y, hp, direction}
        self.bullets = []  # list of {x, y, dir, owner}
        self.last_update = time.time()

    def add_player(self, sid):
        if len(self.players) == 0:
            self.players[sid] = {'x': 100, 'y': 300, 'hp': 100, 'dir': 1}
        else:
            self.players[sid] = {'x': 700, 'y': 300, 'hp': 100, 'dir': -1}

    def remove_player(self, sid):
        if sid in self.players:
            del self.players[sid]

    def move_player(self, sid, direction):
        if sid in self.players:
            self.players[sid]['x'] += 10 * direction  # -1 left, 1 right

    def shoot(self, sid):
        if sid in self.players:
            p = self.players[sid]
            bullet = {'x': p['x'], 'y': p['y'], 'dir': p['dir'], 'owner': sid}
            self.bullets.append(bullet)

    def update(self):
        for bullet in self.bullets:
            bullet['x'] += 15 * bullet['dir']

        self.bullets = [b for b in self.bullets if 0 < b['x'] < 800]

        # collision check
        for b in self.bullets:
            for sid, p in self.players.items():
                if sid != b['owner'] and abs(p['x'] - b['x']) < 20:
                    p['hp'] -= 10
                    b['hit'] = True

        self.bullets = [b for b in self.bullets if 'hit' not in b]

    def get_state(self):
        return {
            'players': self.players,
            'bullets': self.bullets
        }
