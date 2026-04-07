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

    console.log(`🔥 createRoom: Generated roomId=${roomId} after ${attempts} attempts`);

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

    try {
      await set(ref(database, `rooms/${roomId}`), room);
      console.log(`🔥 createRoom: Room ${roomId} successfully written to Firebase`);
    } catch (error) {
      console.error(`🔥 createRoom: Failed to write room:`, error);
      throw error;
    }
    return roomId;
  }

  async joinRoom(roomId, playerName) {
    console.log(`🔥 joinRoom: Attempting to join room ${roomId} as "${playerName}"`);
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      console.error(`🔥 joinRoom: Room ${roomId} not found`);
      throw new Error('Room not found');
    }

    const room = snapshot.val();
    console.log(`🔥 joinRoom: Room data:`, room);
    
    if (room.players.length >= 2) {
      console.error(`🔥 joinRoom: Room ${roomId} is full`);
      throw new Error('Room is full');
    }

    room.players.push({ name: playerName, symbol: 'O' });
    
    try {
      await set(roomRef, room);
      console.log(`🔥 joinRoom: Successfully joined room ${roomId}`);
    } catch (error) {
      console.error(`🔥 joinRoom: Failed to update room:`, error);
      throw error;
    }
    return true;
  }

  async getRoom(roomId) {
    console.log(`🔥 getRoom: Fetching room ${roomId}`);
    const roomRef = ref(database, `rooms/${roomId}`);
    const snapshot = await get(roomRef);
    const exists = snapshot.exists();
    console.log(`🔥 getRoom: Room ${roomId} exists? ${exists}`, exists ? snapshot.val() : null);
    return exists ? snapshot.val() : null;
  }

  subscribeToRoom(roomId, callback) {
    console.log(`🔥 subscribeToRoom: Setting up listener for room ${roomId}`);
    const roomRef = ref(database, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef,
      (snapshot) => {
        console.log(`🔥 subscribeToRoom: onValue triggered for ${roomId}, exists: ${snapshot.exists()}`);
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log(`🔥 subscribeToRoom: Data received:`, data);
          callback(data);
        } else {
          console.warn(`🔥 subscribeToRoom: Room ${roomId} does not exist in Firebase`);
          callback(null);
        }
      },
      (error) => {
        console.error(`🔥 subscribeToRoom: Error for ${roomId}:`, error);
      }
    );
    console.log(`🔥 subscribeToRoom: Subscription active, unsubscribe function returned`);
    return unsubscribe;
  }

//   async makeMove(roomId, move) {
//     console.log(`🔥 makeMove: Room ${roomId}, move:`, move);
//     const roomRef = ref(database, `rooms/${roomId}`);
//     const snapshot = await get(roomRef);
//     if (!snapshot.exists()) {
//       console.error(`🔥 makeMove: Room ${roomId} not found`);
//       return;
//     }

//     const room = snapshot.val();
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

//     try {
//       await set(roomRef, room);
//       console.log(`🔥 makeMove: Move applied successfully`);
//     } catch (error) {
//       console.error(`🔥 makeMove: Failed to update room:`, error);
//     }
//   }

async makeMove(roomId, move) {
  console.log(`🔥 makeMove: Room ${roomId}, move:`, move);
  const roomRef = ref(database, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) {
    console.error(`🔥 makeMove: Room ${roomId} not found`);
    return;
  }

  const room = snapshot.val();
  
  // FIX: If board is missing (Firebase didn't store it), reconstruct
  if (!room.board) {
    console.warn('🔥 makeMove: board missing, reconstructing default');
    room.board = {
      1: null, 2: null, 3: null,
      4: null, 5: null, 6: null,
      7: null, 8: null, 9: null
    };
    if (!room.placementCount) room.placementCount = { X: 0, O: 0 };
    if (!room.selected) room.selected = null;
    if (room.gameOver === undefined) room.gameOver = false;
    if (room.winner === undefined) room.winner = null;
  }

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

  try {
    await set(roomRef, room);
    console.log(`🔥 makeMove: Move applied successfully`);
  } catch (error) {
    console.error(`🔥 makeMove: Failed to update room:`, error);
  }
}

//   async resetGame(roomId) {
//     console.log(`🔥 resetGame: Resetting room ${roomId}`);
//     const roomRef = ref(database, `rooms/${roomId}`);
//     const snapshot = await get(roomRef);
//     if (!snapshot.exists()) {
//       console.error(`🔥 resetGame: Room not found`);
//       return;
//     }

//     const room = snapshot.val();
//     room.board = Object.fromEntries([...Array(9)].map((_, i) => [i + 1, null]));
//     room.placementCount = { X: 0, O: 0 };
//     room.currentPlayer = 'X';
//     room.selected = null;
//     room.gameOver = false;
//     room.winner = null;

//     await set(roomRef, room);
//     console.log(`🔥 resetGame: Room reset`);
//   }

async resetGame(roomId) {
  console.log(`🔥 resetGame: Resetting room ${roomId}`);
  const roomRef = ref(database, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) {
    console.error(`🔥 resetGame: Room not found`);
    return;
  }

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