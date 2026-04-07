import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Users, Copy, Check, Volume2, VolumeX, Home, Play, Bot } from 'lucide-react';
import { gameService } from './firebaseService';

// ============= GAME LOGIC =============
const POS = {
  1: { x: 110, y: 140 }, 2: { x: 310, y: 140 }, 3: { x: 510, y: 140 },
  4: { x: 110, y: 290 }, 5: { x: 310, y: 290 }, 6: { x: 510, y: 290 },
  7: { x: 110, y: 440 }, 8: { x: 310, y: 440 }, 9: { x: 510, y: 440 },
};

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

// ============= AI LOGIC =============
const minimax = (board, depth, isMaximizing, aiPlayer, humanPlayer) => {
  if (checkWin(board, aiPlayer)) return 10 - depth;
  if (checkWin(board, humanPlayer)) return depth - 10;
  if (!Object.values(board).includes(null)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let p = 1; p <= 9; p++) {
      if (board[p] === null) {
        board[p] = aiPlayer;
        const score = minimax(board, depth + 1, false, aiPlayer, humanPlayer);
        board[p] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let p = 1; p <= 9; p++) {
      if (board[p] === null) {
        board[p] = humanPlayer;
        const score = minimax(board, depth + 1, true, aiPlayer, humanPlayer);
        board[p] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
};

const getBestPlacementMove = (board, player) => {
  let bestScore = -Infinity;
  let bestPos = null;
  const opponent = player === 'X' ? 'O' : 'X';

  for (let p = 1; p <= 9; p++) {
    if (board[p] === null) {
      board[p] = player;
      const score = minimax(board, 0, false, player, opponent);
      board[p] = null;
      if (score > bestScore) {
        bestScore = score;
        bestPos = p;
      }
    }
  }
  return bestPos;
};

// ============= COMPONENTS =============
const GameBoard = ({ gameState, playerSymbol, onMove }) => {
  const [animatingPositions, setAnimatingPositions] = useState(new Set());

  if (!gameState || !gameState.board) {
    return (
      <div className="game-board-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#a1a9c3' }}>
        Loading board...
      </div>
    );
  }

  const handlePositionClick = (position) => {
    console.log('🟢 Click attempt:', {
      position,
      gameOver: gameState.gameOver,
      currentPlayer: gameState.currentPlayer,
      mySymbol: playerSymbol,
      isMyTurn: gameState.currentPlayer === playerSymbol,
      placementCount: gameState.placementCount,
      selected: gameState.selected,
      pieceAtPos: gameState.board[position],
    });

    if (gameState.gameOver) {
      console.log('🔴 Click blocked: game over');
      return;
    }
    if (gameState.currentPlayer !== playerSymbol) {
      console.log('🔴 Click blocked: not your turn');
      return;
    }

    const isPlacing = gameState.placementCount[playerSymbol] < 3;
    console.log('🟡 isPlacing phase?', isPlacing);

    if (isPlacing) {
      if (gameState.board[position] === null) {
        setAnimatingPositions(new Set([position]));
        setTimeout(() => setAnimatingPositions(new Set()), 400);
        onMove({ type: 'place', position });
      } else {
        console.log('🔴 Place blocked: position not empty');
      }
    } else {
      if (gameState.selected === null) {
        if (gameState.board[position] === playerSymbol) {
          onMove({ type: 'select', position });
        } else {
          console.log('🔴 Select blocked: not your piece');
        }
      } else {
        if (position === gameState.selected) {
          onMove({ type: 'select', position: null });
        } else if (gameState.board[position] === null && ADJ[gameState.selected]?.includes(position)) {
          setAnimatingPositions(new Set([position]));
          setTimeout(() => setAnimatingPositions(new Set()), 400);
          onMove({ type: 'move', position });
        } else {
          console.log('🔴 Move blocked: invalid destination', {
            empty: gameState.board[position] === null,
            adjacent: ADJ[gameState.selected]?.includes(position)
          });
        }
      }
    }
  };

  const getPositionStyle = (pos) => {
    const { x, y } = POS[pos];
    const baseSize = 620;
    const containerSize = window.innerWidth < 640 ? 500 : baseSize;
    const scale = containerSize / baseSize;

    return {
      left: `${x * scale}px`,
      top: `${y * scale}px`,
    };
  };

  return (
    <div className="game-board-container">
      <svg
        className="board-lines"
        viewBox="0 0 620 620"
        style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)' }}
      >
        <line x1="110" y1="140" x2="510" y2="140" stroke="#67e8f9" strokeWidth="28" strokeLinecap="round" />
        <line x1="110" y1="290" x2="510" y2="290" stroke="#67e8f9" strokeWidth="28" strokeLinecap="round" />
        <line x1="110" y1="440" x2="510" y2="440" stroke="#67e8f9" strokeWidth="28" strokeLinecap="round" />
        <line x1="310" y1="140" x2="310" y2="440" stroke="#67e8f9" strokeWidth="28" strokeLinecap="round" />
      </svg>

      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(pos => {
        const piece = gameState.board[pos];
        const isSelected = gameState.selected === pos;
        const isAnimating = animatingPositions.has(pos);
        const isCurrentPlayerTurn = gameState.currentPlayer === playerSymbol;
        const isPlacingPhaseForMe = gameState.placementCount[playerSymbol] < 3;

        let canClick = !gameState.gameOver && isCurrentPlayerTurn;

        if (canClick) {
          if (isPlacingPhaseForMe) {
            canClick = (piece === null);
          } else {
            if (gameState.selected === null) {
              canClick = (piece === playerSymbol);
            } else {
              canClick = (pos === gameState.selected) ||
                        (piece === null && ADJ[gameState.selected] && ADJ[gameState.selected].includes(pos));
            }
          }
        }

        if (isCurrentPlayerTurn) {
          console.log(`🟠 Position ${pos} canClick: ${canClick} (piece: ${piece}, selected: ${gameState.selected})`);
        }

        const showMoveIndicator = !piece &&
                                 gameState.selected !== null &&
                                 ADJ[gameState.selected] &&
                                 ADJ[gameState.selected].includes(pos);

        return (
          <button
            key={pos}
            className={`board-position ${piece ? `has-piece piece-${piece}` : ''}
              ${isSelected ? 'selected' : ''}
              ${isAnimating ? 'animating' : ''}
              ${canClick ? 'clickable' : ''}`}
            style={getPositionStyle(pos)}
            onClick={() => handlePositionClick(pos)}
            disabled={!canClick}
          >
            {piece && <div className="piece-content">{piece}</div>}
            {showMoveIndicator && <div className="move-indicator" />}
          </button>
        );
      })}
    </div>
  );
};

const GameScreen = ({ roomId, playerName, playerSymbol, onLeave, isVsAI = false }) => {
  const [gameState, setGameState] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  console.log('🎮 GameScreen RENDER:', {
    roomId,
    playerSymbol,
    gameStateExists: !!gameState,
    boardExists: !!gameState?.board,
    gameStateKeys: gameState ? Object.keys(gameState) : null,
  });

  const handleMove = useCallback((move) => {
    console.log('🎮 handleMove called:', move);
    gameService.makeMove(roomId, move);
  }, [roomId]);

  useEffect(() => {
    console.log('🎮 GameScreen MOUNTED with roomId:', roomId);
    return () => {
      console.log('🎮 GameScreen UNMOUNTED for roomId:', roomId);
    };
  }, [roomId]);

  // AI move effect (for vs AI games)
  useEffect(() => {
    if (!isVsAI || !gameState || !gameState.board || gameState.gameOver || gameState.currentPlayer !== 'O') return;
    if (gameState.selected !== null) return;

    const timer = setTimeout(() => {
      const board = { ...gameState.board };
      const isPlacing = (gameState.placementCount?.O ?? 0) < 3;

      if (isPlacing) {
        const bestPos = getBestPlacementMove(board, 'O');
        if (bestPos) handleMove({ type: 'place', position: bestPos });
      } else {
        let bestScore = -Infinity;
        let bestFrom = null;
        let bestTo = null;

        for (let from = 1; from <= 9; from++) {
          if (board[from] !== 'O') continue;
          for (let to of ADJ[from]) {
            if (board[to] !== null) continue;
            const tempBoard = { ...board };
            tempBoard[from] = null;
            tempBoard[to] = 'O';
            const score = minimax(tempBoard, 0, false, 'O', 'X');
            if (score > bestScore) {
              bestScore = score;
              bestFrom = from;
              bestTo = to;
            }
          }
        }
        if (bestFrom && bestTo) {
          handleMove({ type: 'select', position: bestFrom });
          setTimeout(() => handleMove({ type: 'move', position: bestTo }), 80);
        }
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [gameState, isVsAI, handleMove]);

  // Single subscription to room
  useEffect(() => {
    if (!roomId) {
      console.log('🎮 No roomId, skipping subscription');
      return;
    }

    console.log('🎮 Setting up subscription for room:', roomId);
    const unsubscribe = gameService.subscribeToRoom(roomId, (data) => {
      console.log('🎮 Subscription callback received data:', data);
      if (data) {
        console.log('🎮 Data keys:', Object.keys(data));
        console.log('🎮 Data.board exists?', !!data?.board);
        console.log('🎮 placementCount:', data.placementCount);
      }
      setGameState(data);
    });

    return () => {
      console.log('🎮 Cleaning up subscription for room:', roomId);
      unsubscribe();
    };
  }, [roomId]);

  const handleReset = () => {
    console.log('🎮 Reset game requested');
    gameService.resetGame(roomId);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gameState || !gameState.board) {
    console.log('🎮 Rendering loading screen because gameState or board is missing');
    return <div className="loading-screen">Loading game... (check console)</div>;
  }

  console.log('🎮 Rendering game UI with board');

  const opponent = gameState.players?.find(p => p.symbol !== playerSymbol);
  const isMyTurn = gameState.currentPlayer === playerSymbol;
  const isPlacing = (gameState.placementCount?.[gameState.currentPlayer] ?? 0) < 3;

  return (
    <div className="game-screen">
      <div className="game-header">
        <button className="icon-btn" onClick={onLeave}><Home size={20} /></button>

        <div className="room-code" onClick={copyRoomId}>
          <span className="room-label">{isVsAI ? 'Solo vs AI' : 'Room'}</span>
          <span className="room-id">{isVsAI ? 'AI Bot' : roomId}</span>
          {!isVsAI && (copied ? <Check size={16} /> : <Copy size={16} />)}
        </div>

        <button className="icon-btn" onClick={() => setSoundEnabled(!soundEnabled)}>
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      <div className="players-bar">
        <div className={`player-card ${playerSymbol === 'X' ? 'active' : ''} ${gameState.currentPlayer === 'X' ? 'turn' : ''}`}>
          <div className="player-symbol">X</div>
          <div className="player-info">
            <div className="player-name">{gameState.players?.[0]?.name || 'Player X'}</div>
            <div className="player-pieces">{gameState.placementCount?.X ?? 0}/3 placed</div>
          </div>
        </div>
        <div className={`player-card ${playerSymbol === 'O' ? 'active' : ''} ${gameState.currentPlayer === 'O' ? 'turn' : ''}`}>
          <div className="player-symbol">O</div>
          <div className="player-info">
            <div className="player-name">{isVsAI ? '🤖 AI Bot' : (opponent?.name || 'Waiting...')}</div>
            <div className="player-pieces">{gameState.placementCount?.O ?? 0}/3 placed</div>
          </div>
        </div>
      </div>

      {!gameState.gameOver && (gameState.players?.length ?? 0) < 2 && !isVsAI && (
        <div className="status-message waiting">
          <Users size={20} /> Waiting for opponent to join...
        </div>
      )}

      {!gameState.gameOver && ((gameState.players?.length ?? 0) === 2 || isVsAI) && (
        <div className={`status-message ${isMyTurn ? 'your-turn' : 'opponent-turn'}`}>
          {isMyTurn ? (
            <>
              <Play size={20} />
              Your turn • {isPlacing ? 'Place a piece' : 'Move along the roads'}
            </>
          ) : (
            <>
              <AlertCircle size={20} />
              {isVsAI ? "AI is thinking..." : "Opponent's turn"}
            </>
          )}
        </div>
      )}

      <GameBoard
        key={playerSymbol}
        gameState={gameState}
        playerSymbol={playerSymbol}
        onMove={handleMove}
      />

      {gameState.gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            {gameState.winner ? (
              <>
                <div className={`winner-symbol symbol-${gameState.winner}`}>
                  {gameState.winner}
                </div>
                <h2 className="game-over-title">
                  {gameState.winner === playerSymbol ? 'You Win!' : (isVsAI ? 'AI Wins' : 'You Lose')}
                </h2>
                <p className="game-over-subtitle">
                  {gameState.winner === playerSymbol ? 'Excellent strategy!' : 'Better luck next time'}
                </p>
              </>
            ) : (
              <>
                <div className="draw-icon">⚡</div>
                <h2 className="game-over-title">Draw</h2>
                <p className="game-over-subtitle">No legal moves remaining</p>
              </>
            )}
            <div className="game-over-actions">
              <button className="btn btn-primary" onClick={handleReset}>Play Again</button>
              <button className="btn btn-secondary" onClick={onLeave}>Back to Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuScreen = ({ onCreateRoom, onJoinRoom, onSolo }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!playerName.trim()) { setError('Please enter your name'); return; }
    setError('');
    onCreateRoom(playerName);
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('Please enter your name'); return; }
    if (!roomId.trim()) { setError('Please enter room code'); return; }
    setError('');
    onJoinRoom(roomId.toUpperCase(), playerName);
  };

  const handleSoloClick = () => {
    if (!playerName.trim()) { setError('Please enter your name'); return; }
    setError('');
    onSolo(playerName);
  };

  return (
    <div className="menu-screen">
      <div className="menu-content">
        <div className="logo-container">
          <div className="logo-symbol">⚡</div>
          <h1 className="logo-title">Alignment</h1>
          <p className="logo-subtitle">Strategic board game • Online + Solo</p>
        </div>

        <div className="menu-form">
          <input
            type="text"
            className="input-field"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
          />

          {showJoin && (
            <input
              type="text"
              className="input-field"
              placeholder="Enter room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              maxLength={6}
            />
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="menu-actions">
            {!showJoin ? (
              <>
                <button className="btn btn-primary btn-large" onClick={handleCreate}>
                  Create Online Game
                </button>
                <button className="btn btn-secondary btn-large" onClick={handleSoloClick}>
                  <Bot size={22} /> Play vs AI (Solo)
                </button>
                <button className="btn btn-secondary btn-large" onClick={() => setShowJoin(true)}>
                  Join Online Game
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-large" onClick={handleJoin}>Join Room</button>
                <button className="btn btn-secondary btn-large" onClick={() => setShowJoin(false)}>Back</button>
              </>
            )}
          </div>
        </div>

        <div className="how-to-play">
          <h3>How to Play</h3>
          <ol>
            <li>Each player gets 3 pieces</li>
            <li>Place them on the dots</li>
            <li>Then slide them along the roads</li>
            <li>First to make a straight line of 3 wins!</li>
          </ol>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', color: '#a1a9c3'}}>
            The glowing roads are now visible
          </p>
        </div>
      </div>
    </div>
  );
};

// ============= MAIN APP =============
export default function AlignmentGame() {
  const [screen, setScreen] = useState('menu');
  const [roomId, setRoomId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [isVsAI, setIsVsAI] = useState(false);

  const handleCreateRoom = async (name) => {
    const id = await gameService.createRoom(name);
    setRoomId(id);
    setPlayerName(name);
    setPlayerSymbol('X');
    setIsVsAI(false);
    setScreen('game');
  };

  const handleJoinRoom = async (id, name) => {
    try {
      await gameService.joinRoom(id, name);
      setRoomId(id);
      setPlayerName(name);
      setPlayerSymbol('O');
      setIsVsAI(false);
      setScreen('game');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSolo = async (name) => {
    const id = await gameService.createRoom(name);
    await gameService.joinRoom(id, 'AI Bot');
    setRoomId(id);
    setPlayerName(name);
    setPlayerSymbol('X');
    setIsVsAI(true);
    setScreen('game');
  };

  const handleLeave = () => {
    setScreen('menu');
    setRoomId(null);
    setPlayerName('');
    setPlayerSymbol(null);
    setIsVsAI(false);
  };

  return (
    <div className="app">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --bg-primary: #0a0e1a;
          --bg-secondary: #151b2e;
          --bg-tertiary: #1e2538;
          --text-primary: #ffffff;
          --text-secondary: #a1a9c3;
          --text-muted: #6b7280;
          --accent-blue: #3b82f6;
          --accent-purple: #8b5cf6;
          --accent-pink: #ec4899;
          --x-color: #3b82f6;
          --o-color: #ec4899;
          --border-color: rgba(255, 255, 255, 0.1);
          --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .app { min-height: 100vh; background: linear-gradient(135deg, #0a0e1a 0%, #1e2538 100%); color: var(--text-primary); overflow-x: hidden; }

        .menu-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; background: radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%); }
        .menu-content { max-width: 480px; width: 100%; animation: fadeInUp 0.6s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .logo-container { text-align: center; margin-bottom: 3rem; }
        .logo-symbol { font-size: 4rem; margin-bottom: 1rem; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .logo-title { font-size: 3.5rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .logo-subtitle { color: var(--text-secondary); font-size: 0.95rem; }
        .menu-form { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 24px; padding: 2rem; margin-bottom: 2rem; box-shadow: var(--shadow-lg); }
        .input-field { width: 100%; padding: 1rem 1.25rem; background: var(--bg-tertiary); border: 2px solid transparent; border-radius: 12px; color: var(--text-primary); font-size: 1rem; margin-bottom: 1rem; transition: all 0.2s; }
        .input-field:focus { outline: none; border-color: var(--accent-blue); background: var(--bg-primary); }
        .input-field::placeholder { color: var(--text-muted); }
        .menu-actions { display: flex; flex-direction: column; gap: 0.75rem; }
        .btn { padding: 1rem 1.5rem; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-primary { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white; box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4); }
        .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
        .btn-secondary:hover { background: var(--bg-primary); border-color: var(--accent-blue); }
        .btn-large { padding: 1.25rem 1.5rem; font-size: 1.1rem; }
        .error-message { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.9rem; margin-bottom: 1rem; }
        .how-to-play { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; }
        .how-to-play h3 { font-size: 1.1rem; margin-bottom: 1rem; color: var(--accent-blue); }
        .how-to-play ol { list-style-position: inside; color: var(--text-secondary); line-height: 1.8; }
        .how-to-play li { font-size: 0.9rem; }

        .game-screen { min-height: 100vh; padding: 1rem; display: flex; flex-direction: column; }
        .game-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding: 0.5rem; }
        .icon-btn { width: 48px; height: 48px; border-radius: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .icon-btn:hover { background: var(--bg-tertiary); border-color: var(--accent-blue); }
        .room-code { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.75rem 1.25rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .room-code:hover { border-color: var(--accent-blue); }
        .room-label { color: var(--text-muted); font-size: 0.85rem; }
        .room-id { font-weight: 700; font-size: 1.1rem; letter-spacing: 0.05em; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .players-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .player-card { background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 16px; padding: 1rem; display: flex; align-items: center; gap: 1rem; transition: all 0.3s; opacity: 0.6; }
        .player-card.active { opacity: 1; }
        .player-card.turn { border-color: var(--accent-blue); box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); } 50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.5); } }
        .player-symbol { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; flex-shrink: 0; }
        .player-card:nth-child(1) .player-symbol { background: linear-gradient(135deg, var(--x-color), #60a5fa); color: white; }
        .player-card:nth-child(2) .player-symbol { background: linear-gradient(135deg, var(--o-color), #f472b6); color: white; }
        .player-info { flex: 1; min-width: 0; }
        .player-name { font-weight: 600; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .player-pieces { font-size: 0.85rem; color: var(--text-muted); }
        .status-message { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 0.75rem; font-weight: 500; }
        .status-message.your-turn { background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1)); border-color: var(--accent-blue); color: var(--accent-blue); }
        .status-message.opponent-turn { color: var(--text-secondary); }
        .status-message.waiting { color: var(--text-secondary); }

        .game-board-container { position: relative; width: 100%; max-width: 620px; height: 620px; margin: 0 auto; flex: 1; display: flex; align-items: center; justify-content: center; }
        .board-lines { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 620px; height: 620px; pointer-events: none; z-index: 1; }
        .board-position { position: absolute; width: 76px; height: 76px; border-radius: 50%; background: var(--bg-secondary); border: 3px solid var(--border-color); cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; z-index: 2; }
        .board-position:disabled { cursor: not-allowed; opacity: 0.7; }
        .board-position.clickable:not(:disabled):hover { transform: translate(-50%, -50%) scale(1.1); border-color: var(--accent-blue); box-shadow: 0 0 24px rgba(59, 130, 246, 0.4); }
        .board-position.selected { border-color: #fbbf24; border-width: 4px; box-shadow: 0 0 32px rgba(251, 191, 36, 0.5); animation: selectedPulse 1.5s ease-in-out infinite; }
        @keyframes selectedPulse { 0%, 100% { box-shadow: 0 0 32px rgba(251, 191, 36, 0.5); } 50% { box-shadow: 0 0 48px rgba(251, 191, 36, 0.7); } }
        .board-position.has-piece { border-width: 0; cursor: default; }
        .board-position.piece-X { background: linear-gradient(135deg, var(--x-color), #60a5fa); box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4); }
        .board-position.piece-O { background: linear-gradient(135deg, var(--o-color), #f472b6); box-shadow: 0 8px 24px rgba(236, 72, 153, 0.4); }
        .board-position.animating { animation: placeAnimation 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes placeAnimation { 0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); } 50% { transform: translate(-50%, -50%) scale(1.2) rotate(180deg); } 100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); } }
        .piece-content { font-size: 2rem; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
        .move-indicator { width: 20px; height: 20px; border-radius: 50%; background: rgba(251, 191, 36, 0.4); border: 2px solid #fbbf24; animation: indicatorPulse 1s ease-in-out infinite; }
        @keyframes indicatorPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }

        .game-over-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(10, 14, 26, 0.95); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 2rem; animation: fadeIn 0.3s ease-out; z-index: 100; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .game-over-content { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 24px; padding: 3rem 2rem; text-align: center; max-width: 400px; width: 100%; animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .winner-symbol { width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 800; color: white; margin: 0 auto 1.5rem; animation: winnerBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .winner-symbol.symbol-X { background: linear-gradient(135deg, var(--x-color), #60a5fa); box-shadow: 0 12px 40px rgba(59, 130, 246, 0.5); }
        .winner-symbol.symbol-O { background: linear-gradient(135deg, var(--o-color), #f472b6); box-shadow: 0 12px 40px rgba(236, 72, 153, 0.5); }
        @keyframes winnerBounce { 0% { transform: scale(0) rotate(0deg); } 50% { transform: scale(1.2) rotate(180deg); } 100% { transform: scale(1) rotate(360deg); } }
        .draw-icon { font-size: 4rem; margin-bottom: 1.5rem; }
        .game-over-title { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .game-over-subtitle { color: var(--text-secondary); margin-bottom: 2rem; }
        .game-over-actions { display: flex; flex-direction: column; gap: 0.75rem; }

        @media (max-width: 640px) {
          .game-board-container { height: 500px; max-width: 500px; }
          .board-lines { max-width: 500px; height: 500px; }
          .board-position { width: 64px; height: 64px; }
          .piece-content { font-size: 1.75rem; }
          .logo-title { font-size: 2.5rem; }
          .players-bar { grid-template-columns: 1fr; }
        }

        .loading-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--text-secondary); }
      `}</style>

      {screen === 'menu' ? (
        <MenuScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onSolo={handleSolo}
        />
      ) : (
        <GameScreen
          roomId={roomId}
          playerName={playerName}
          playerSymbol={playerSymbol}
          onLeave={handleLeave}
          isVsAI={isVsAI}
        />
      )}
    </div>
  );
}