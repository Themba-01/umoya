import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get } from 'firebase/database';

// ============= FIREBASE CONFIG =============
const firebaseConfig = {
  apiKey: "AIzaSyCklobIKvV-S-9TCcRpMNMlX9Q7wVKpI9U",
  authDomain: "alignment-game-b821a.firebaseapp.com",
  databaseURL: "https://alignment-game-b821a-default-rtdb.firebaseio.com",
  projectId: "alignment-game-b821a",
  storageBucket: "alignment-game-b821a.firebasestorage.app",
  messagingSenderId: "296322445838",
  appId: "1:296322445838:web:996ec5769e278dd310425f"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============= SHARED GAME HELPERS =============
const ADJ = {
  1: [2], 2: [1, 3, 5], 3: [2],
  4: [5], 5: [2, 4, 6, 8], 6: [5],
  7: [8], 8: [5, 7, 9], 9: [8]
};

const WINNING_LINES = [
  [1, 2, 3], [4, 5, 6], [7, 8, 9], [2, 5, 8]
];

const checkWin = (board, player) => {
  return WINNING_LINES.some(line => line.every(p => board[p] === player));
};

const hasLegalMove = (board, player) => {
  for (let p = 1; p <= 9; p++) {
    if (board[p] === player) {
      for (let t of ADJ[p]) {
        if (board[t] === null) return true;
      }
    }
  }
  return false;
};

// ============= PRODUCTION FIREBASE GAME SERVICE =============
export class FirebaseGameService {
  async createRoom(playerName) {
    let roomId = '';
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
      const roomRef = ref(database, `rooms/${roomId}`);
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) break;
      attempts++;
    }

    const room = {
      id: roomId,
      players: [{ name: playerName, symbol: 'X' }],
      board: Object.fromEntries([...Array(9)].map((_, i) => [i + 1, null])),
      placementCount: { X: 0, O: 0 },
      currentPlayer: 'X',
      selected: null,
      gameOver: false,
      winner: null,
      createdAt: Date.now()
    };

    await set(ref(database, `rooms/${roomId}`), room);
    return roomId;
  }

  async joinRoom(roomId, playerName) {
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) throw new Error('Room not found');

    const room = snapshot.val();
    if (room.players.length >= 2) throw new Error('Room is full');

    room.players.push({ name: playerName, symbol: 'O' });
    await set(roomRef, room);
    return true;
  }

  subscribeToRoom(roomId, callback) {
    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
  }

  async makeMove(roomId, move) {
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) return;

    const room = snapshot.val();
    const { board, placementCount, currentPlayer } = room;
    const isPlacing = placementCount[currentPlayer] < 3;

    if (isPlacing && move.type === 'place') {
      if (board[move.position] === null) {
        board[move.position] = currentPlayer;
        placementCount[currentPlayer]++;
        room.selected = null;

        if (checkWin(board, currentPlayer)) {
          room.gameOver = true;
          room.winner = currentPlayer;
        } else {
          room.currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        }
      }
    } else if (!isPlacing && move.type === 'select') {
      room.selected = move.position;
    } else if (!isPlacing && move.type === 'move') {
      if (room.selected && board[move.position] === null && ADJ[room.selected].includes(move.position)) {
        board[room.selected] = null;
        board[move.position] = currentPlayer;
        room.selected = null;

        if (checkWin(board, currentPlayer)) {
          room.gameOver = true;
          room.winner = currentPlayer;
        } else {
          const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';
          room.currentPlayer = nextPlayer;

          if (placementCount[nextPlayer] >= 3 && !hasLegalMove(board, nextPlayer)) {
            room.gameOver = true;
            room.winner = null;
          }
        }
      }
    }

    await set(roomRef, room);
  }

  async resetGame(roomId) {
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) return;

    const room = snapshot.val();
    room.board = Object.fromEntries([...Array(9)].map((_, i) => [i + 1, null]));
    room.placementCount = { X: 0, O: 0 };
    room.currentPlayer = 'X';
    room.selected = null;
    room.gameOver = false;
    room.winner = null;

    await set(roomRef, room);
  }
}

// Export singleton instance
export const gameService = new FirebaseGameService();