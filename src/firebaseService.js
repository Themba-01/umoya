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

console.log('🔥 Firebase: Initializing app...');
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
console.log('🔥 Firebase: App initialized, database reference obtained');

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

// Helper to ensure board is a plain object (Firebase sometimes converts to array)
function normalizeBoard(board) {
  if (!board) {
    return {
      1: null, 2: null, 3: null,
      4: null, 5: null, 6: null,
      7: null, 8: null, 9: null
    };
  }
  // If it's an array (Firebase coercion), convert back to object with numeric keys 1-9
  if (Array.isArray(board)) {
    console.warn('⚠️ Board was an array! Converting to object.');
    const newBoard = {};
    for (let i = 1; i <= 9; i++) {
      newBoard[i] = board[i] !== undefined ? board[i] : null;
    }
    return newBoard;
  }
  // Ensure all 9 positions exist
  for (let i = 1; i <= 9; i++) {
    if (board[i] === undefined) board[i] = null;
  }
  return board;
}

function ensureRoomFields(room) {
  room.board = normalizeBoard(room.board);
  if (!room.placementCount) room.placementCount = { X: 0, O: 0 };
  if (room.placementCount.X === undefined) room.placementCount.X = 0;
  if (room.placementCount.O === undefined) room.placementCount.O = 0;
  if (!room.selected) room.selected = null;
  if (room.gameOver === undefined) room.gameOver = false;
  if (room.winner === undefined) room.winner = null;
  if (!room.players) room.players = [];
  // Ensure each player has a symbol
  room.players = room.players.filter(p => p && p.symbol);
  return room;
}

// ============= PRODUCTION FIREBASE GAME SERVICE =============
export class FirebaseGameService {
  async createRoom(playerName) {
    console.log(`🔥 createRoom: Starting with playerName="${playerName}"`);
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

    console.log(`🔥 createRoom: Generated roomId=${roomId}`);

    const room = {
      id: roomId,
      players: [{ name: playerName, symbol: 'X' }],
      board: {
        1: null, 2: null, 3: null,
        4: null, 5: null, 6: null,
        7: null, 8: null, 9: null
      },
      placementCount: { X: 0, O: 0 },
      currentPlayer: 'X',
      selected: null,
      gameOver: false,
      winner: null,
      createdAt: Date.now()
    };

    console.log('🔥 createRoom: Writing room:', JSON.stringify(room));
    await set(ref(database, `rooms/${roomId}`), room);
    console.log(`🔥 createRoom: Room ${roomId} written successfully`);
    return roomId;
  }

  async joinRoom(roomId, playerName) {
    console.log(`🔥 joinRoom: Joining room ${roomId} as "${playerName}"`);
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) throw new Error('Room not found');

    const room = snapshot.val();
    ensureRoomFields(room);
    console.log(`🔥 joinRoom: Current players:`, room.players);

    if (room.players.length >= 2) throw new Error('Room is full');

    room.players.push({ name: playerName, symbol: 'O' });
    console.log(`🔥 joinRoom: Updated players:`, room.players);

    await set(roomRef, room);
    console.log(`🔥 joinRoom: Successfully joined`);
    return true;
  }

  subscribeToRoom(roomId, callback) {
    console.log(`🔥 subscribeToRoom: Setting up listener for room ${roomId}`);
    const roomRef = ref(database, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          ensureRoomFields(data);
          console.log(`🔥 subscribeToRoom: Data received, board type:`, Array.isArray(data.board) ? 'array' : 'object');
          callback(data);
        } else {
          callback(null);
        }
      },
      (error) => console.error(`🔥 subscribeToRoom error:`, error)
    );
    return unsubscribe;
  }

//   async makeMove(roomId, move) {
//     console.log(`🔥 makeMove: Room ${roomId}, move:`, move);
//     const roomRef = ref(database, `rooms/${roomId}`);
//     const snapshot = await get(roomRef);
//     if (!snapshot.exists()) return;

//     const room = snapshot.val();
//     ensureRoomFields(room);

//     const { board, placementCount, currentPlayer } = room;
//     const isPlacing = placementCount[currentPlayer] < 3;

//     if (isPlacing && move.type === 'place') {
//       if (board[move.position] === null) {
//         board[move.position] = currentPlayer;
//         placementCount[currentPlayer]++;
//         room.selected = null;

//         if (checkWin(board, currentPlayer)) {
//           room.gameOver = true;
//           room.winner = currentPlayer;
//         } else {
//           room.currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
//         }
//       }
//     } else if (!isPlacing && move.type === 'select') {
//       room.selected = move.position;
//     } else if (!isPlacing && move.type === 'move') {
//       if (room.selected && board[move.position] === null && ADJ[room.selected].includes(move.position)) {
//         board[room.selected] = null;
//         board[move.position] = currentPlayer;
//         room.selected = null;

//         if (checkWin(board, currentPlayer)) {
//           room.gameOver = true;
//           room.winner = currentPlayer;
//         } else {
//           const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';
//           room.currentPlayer = nextPlayer;

//           if (placementCount[nextPlayer] >= 3 && !hasLegalMove(board, nextPlayer)) {
//             room.gameOver = true;
//             room.winner = null;
//           }
//         }
//       }
//     }

//     await set(roomRef, room);
//     console.log(`🔥 makeMove: Move applied, currentPlayer now: ${room.currentPlayer}`);
//   }

async makeMove(roomId, move) {
  console.log(`🔥 makeMove: Room ${roomId}, move:`, move);
  const roomRef = ref(database, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;

  const room = snapshot.val();
  ensureRoomFields(room);

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

        // 🔄 FORCED REPLAY RULE
        // If the next player has already placed 3 pieces and has no legal moves,
        // keep the turn with the current player (they must move again).
        if (placementCount[nextPlayer] >= 3 && !hasLegalMove(board, nextPlayer)) {
          room.currentPlayer = currentPlayer; // Give turn back
          console.log(`🔄 Next player (${nextPlayer}) has no legal moves. ${currentPlayer} plays again.`);
        }
      }
    }
  }

  await set(roomRef, room);
  console.log(`🔥 makeMove: Move applied, currentPlayer now: ${room.currentPlayer}`);
}

  async resetGame(roomId) {
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) return;

    const room = snapshot.val();
    room.board = {
      1: null, 2: null, 3: null,
      4: null, 5: null, 6: null,
      7: null, 8: null, 9: null
    };
    room.placementCount = { X: 0, O: 0 };
    room.currentPlayer = 'X';
    room.selected = null;
    room.gameOver = false;
    room.winner = null;

    await set(roomRef, room);
    console.log(`🔥 resetGame: Room reset`);
  }
}

export const gameService = new FirebaseGameService();