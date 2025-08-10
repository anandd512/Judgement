// Client-side JavaScript for Judgement Card Game
class JudgementGame {
    constructor() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            maxReconnectionAttempts: 5
        });
        this.gameState = null;
        this.playerHand = [];
        this.dealingCards = []; // Add dealing cards tracking
        this.validCards = []; // Add valid cards tracking
        this.playerIndex = -1;
        this.gameCode = '';
        this.reconnectAttempts = 0;
        this.isMobile = this.detectMobile();
        this.bidTimer = null;
        this.moveTimer = null;
        this.currentTimerSeconds = 30;
        this.sortCardsUsed = false;
        this.cardsAreSorted = false;
        this.isPlayingCard = false; // Prevent multiple card plays
        
        this.initializeEventListeners();
        this.setupSocketListeners();
        this.setupMobileOptimizations();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
               || window.innerWidth <= 768;
    }

    setupMobileOptimizations() {
        if (this.isMobile) {
            // Prevent zoom on input focus for iOS
            document.addEventListener('touchstart', () => {}, { passive: true });
            
            // Add mobile-specific classes
            document.body.classList.add('mobile-device');
            
            // Improve card selection for mobile
            this.setupMobileCardInteraction();
            
            // Prevent pull-to-refresh
            document.body.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1 && window.scrollY === 0) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
    }

    setupMobileCardInteraction() {
        // Add touch-friendly card selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.card')) {
                const card = e.target.closest('.card');
                if (card.classList.contains('playable')) {
                    // Add visual feedback for mobile
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        card.style.transform = '';
                    }, 150);
                }
            }
        });
    }

    initializeEventListeners() {
        // Start screen events
        document.getElementById('host-btn').addEventListener('click', () => this.hostGame());
        document.getElementById('join-btn').addEventListener('click', () => this.joinGame());
        
        // Game events
        document.getElementById('place-bid-btn').addEventListener('click', () => this.showBidModal());
        document.getElementById('next-round-btn').addEventListener('click', () => this.startNextRound());
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        
        // New game controls
        document.getElementById('pause-btn').addEventListener('click', () => this.pauseGame());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopGame());
        document.getElementById('chat-toggle-btn').addEventListener('click', () => this.toggleChat());
        document.getElementById('sort-cards-btn').addEventListener('click', () => this.sortCards());
        document.getElementById('chat-close-btn').addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-send-btn').addEventListener('click', () => this.sendChatMessage());
        
        // Bid modal events
        document.querySelectorAll('.bid-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectBid(parseInt(e.target.dataset.bid)));
        });
        
        // Trump selection
        document.querySelectorAll('.trump-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTrump(e.target.dataset.suit));
        });
        
        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('error-modal').style.display = 'none';
        });
        
        // Enter key handlers
        document.getElementById('host-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.hostGame();
        });
        
        document.getElementById('game-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
    }

    setupSocketListeners() {
        // Connection status handlers
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus('connected', 'Connected');
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.updateConnectionStatus('disconnected', 'Disconnected');
            if (reason === 'io server disconnect') {
                // Server disconnected the client, try to reconnect manually
                this.socket.connect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.log('Connection error:', error);
            this.reconnectAttempts++;
            this.updateConnectionStatus('disconnected', `Retrying... (${this.reconnectAttempts}/5)`);
            
            if (this.reconnectAttempts >= 5) {
                this.showError('Failed to connect to server. Please refresh the page.');
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
            this.updateConnectionStatus('connected', 'Reconnected');
            this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            this.updateConnectionStatus('disconnected', `Reconnecting... (${attemptNumber}/5)`);
        });

        this.socket.on('reconnect_failed', () => {
            this.updateConnectionStatus('disconnected', 'Connection Failed');
            this.showError('Unable to reconnect to server. Please refresh the page.');
        });

        // Game event handlers
        this.socket.on('game_hosted', (data) => {
            this.gameCode = data.gameCode;
            document.getElementById('display-game-code').textContent = data.gameCode;
            this.showScreen('waiting-screen');
        });

        this.socket.on('game_joined', (data) => {
            this.gameCode = data.gameCode;
            document.getElementById('display-game-code').textContent = data.gameCode;
            this.showScreen('waiting-screen');
        });

        this.socket.on('game_state', (gameState) => {
            this.gameState = gameState;
            this.updateGameDisplay();
        });

        this.socket.on('hand_update', (hand) => {
            this.playerHand = hand;
            this.updateHandDisplay();
        });

        this.socket.on('chat_message', (data) => {
            this.addChatMessage(data.playerName, data.message, data.playerId === this.socket.id);
            
            // Show notification if chat is closed and message is from another player
            if (data.playerId !== this.socket.id) {
                this.showChatNotification(data.playerName, data.message);
            }
        });

        this.socket.on('timer_start', (data) => {
            this.startTimer(data.duration / 1000, data.type || 'game'); // Convert to seconds and default to game type
        });

        this.socket.on('timer_update', (data) => {
            this.updateTimer(data.seconds, data.type);
        });

        this.socket.on('valid_cards', (validCards) => {
            this.validCards = validCards;
            this.updateHandDisplay(); // Refresh hand display with new valid cards
        });

        this.socket.on('card_dealing_started', () => {
            this.startCardDealingAnimation();
        });

        this.socket.on('card_dealt', (data) => {
            this.addCardToHand(data.card, data.cardIndex, data.totalCards);
        });

        this.socket.on('sorting_started', () => {
            this.startSortingAnimation();
        });

        this.socket.on('sorting_completed', () => {
            this.completeSorting();
        });

        this.socket.on('clearBoard', () => {
            this.clearGameBoard();
        });

        this.socket.on('roundCountdown', (data) => {
            this.startRoundCountdown(data.seconds, data.nextRound);
        });

        this.socket.on('roundEnded', (data) => {
            this.showRoundEndScreen(data);
        });

        this.socket.on('gameEnded', (data) => {
            this.showGameEndScreen(data);
        });

        this.socket.on('player_disconnected', (data) => {
            this.handlePlayerDisconnected(data);
        });

        this.socket.on('gamePaused', (data) => {
            this.handleGamePaused(data);
        });

        this.socket.on('gameStopped', (data) => {
            this.handleGameStopped(data);
        });

        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    hostGame() {
        const playerName = document.getElementById('host-name').value.trim();
        const maxRounds = parseInt(document.getElementById('max-rounds').value) || 7;
        
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }
        
        if (maxRounds < 1 || maxRounds > 11) {
            this.showError('Max rounds must be between 1 and 11');
            return;
        }

        this.socket.emit('host_game', { playerName, maxRounds });
    }

    joinGame() {
        const playerName = document.getElementById('join-name').value.trim();
        const gameCode = document.getElementById('game-code').value.trim().toUpperCase();
        
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }
        
        if (!gameCode) {
            this.showError('Please enter game code');
            return;
        }

        this.socket.emit('join_game', { playerName, gameCode });
    }

    placeBid() {
        const bidAmount = parseInt(document.getElementById('bid-amount').value);
        
        if (bidAmount < 6 || bidAmount > 13) {
            this.showError('Bid must be between 6 and 13');
            return;
        }

        this.socket.emit('place_bid', { bidAmount });
    }

    selectTrump(trumpSuit) {
        this.socket.emit('select_trump', { trumpSuit });
    }

    playCard(card) {
        // Prevent multiple rapid calls
        if (this.isPlayingCard) {
            return;
        }
        
        // Validate it's the player's turn and game phase
        if (this.gameState?.currentPlayer !== this.playerIndex) {
            return;
        }
        if (this.gameState?.gamePhase !== 'playing') {
            return;
        }
        
        // Check if player has already played in this trick
        const currentTrick = this.gameState?.currentTrick || [];
        const playerAlreadyPlayed = currentTrick.some(trickCard => trickCard.playerId === this.playerIndex);
        if (playerAlreadyPlayed) {
            return;
        }
        
        // Set flag to prevent multiple plays
        this.isPlayingCard = true;
        
        // Remove card from hand immediately for better UX
        const cardIndex = this.playerHand.findIndex(c => 
            c.rank === card.rank && c.suit === card.suit
        );
        if (cardIndex !== -1) {
            this.playerHand.splice(cardIndex, 1);
            this.updateHandDisplay();
        }
        
        // Clear the flag after a short delay
        setTimeout(() => {
            this.isPlayingCard = false;
        }, 1000);
        
        this.socket.emit('play_card', { card });
    }

    startNextRound() {
        this.socket.emit('start_next_round', {});
    }

    newGame() {
        location.reload();
    }

    // === NEW ENHANCED FEATURES ===

    toggleChat() {
        const chatPanel = document.getElementById('chat-panel');
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        
        chatPanel.classList.toggle('active');
        
        // Remove notification badge when chat is opened
        if (chatPanel.classList.contains('active')) {
            chatToggleBtn.classList.remove('notification');
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (message && this.gameCode) {
            this.socket.emit('chat_message', { 
                message, 
                gameCode: this.gameCode 
            });
            input.value = '';
        }
    }

    addChatMessage(playerName, message, isOwn = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${isOwn ? 'own' : ''}`;
        
        messageElement.innerHTML = `
            <div class="sender">${playerName}</div>
            <div class="message">${message}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showChatNotification(playerName, message) {
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        const chatPanel = document.getElementById('chat-panel');
        
        // Only show notification if chat is closed
        if (!chatPanel.classList.contains('open')) {
            // Add notification badge
            chatToggleBtn.classList.add('notification');
            
            // Show toast notification with actual message content
            const truncatedMessage = message.length > 50 ? message.substring(0, 47) + '...' : message;
            this.showToast(`💬 ${playerName}: ${truncatedMessage}`);
            
            // Auto-remove notification after 5 seconds
            setTimeout(() => {
                chatToggleBtn.classList.remove('notification');
            }, 5000);
        }
    }

    showToast(message, duration = 3000) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Show and auto-hide
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, duration);
    }

    sortCards() {
        if (this.sortCardsUsed) {
            this.showError('Sort cards can only be used once per round');
            return;
        }
        
        // Sort cards by suit and then by value
        this.playerHand.sort((a, b) => {
            if (a.suit !== b.suit) {
                const suitOrder = ['clubs', 'diamonds', 'hearts', 'spades'];
                return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
            }
            return a.value - b.value;
        });
        
        this.sortCardsUsed = true;
        this.cardsAreSorted = true;
        document.getElementById('sort-cards-btn').disabled = true;
        this.updateHandDisplay();
    }

    showBidModal() {
        if (this.gameState?.currentPlayer !== this.playerIndex) return;
        
        document.getElementById('bid-modal').style.display = 'block';
        this.startBidTimer(30);
    }

    selectBid(bidAmount) {
        this.clearTimer();
        document.getElementById('bid-modal').style.display = 'none';
        this.socket.emit('place_bid', { bidAmount });
    }

    startBidTimer(seconds) {
        this.currentTimerSeconds = seconds;
        this.updateBidTimer();
        
        this.bidTimer = setInterval(() => {
            this.currentTimerSeconds--;
            this.updateBidTimer();
            
            if (this.currentTimerSeconds <= 0) {
                this.clearTimer();
                // Auto-bid minimum if time runs out
                this.selectBid(6);
            }
        }, 1000);
    }

    updateBidTimer() {
        const timerElement = document.getElementById('bid-modal-timer');
        const bidTimerElement = document.getElementById('bid-timer');
        const timerCircle = document.querySelector('.timer-circle');
        
        if (timerElement) timerElement.textContent = this.currentTimerSeconds;
        if (bidTimerElement) {
            bidTimerElement.textContent = this.currentTimerSeconds;
            bidTimerElement.classList.toggle('warning', this.currentTimerSeconds <= 10);
        }
        if (timerCircle) {
            timerCircle.classList.toggle('warning', this.currentTimerSeconds <= 10);
        }
    }

    startTimer(seconds, type = 'game') {
        this.currentTimerSeconds = seconds;
        this.timerType = type;
        
        // Clear any existing timer
        this.clearTimer();
        
        if (type === 'bid') {
            this.bidTimer = setInterval(() => {
                this.currentTimerSeconds--;
                this.updateBidTimer();
                
                if (this.currentTimerSeconds <= 0) {
                    this.clearTimer();
                    this.currentTimerSeconds = 0; // Prevent negative
                    // Auto-bid minimum if time runs out
                    this.autoBid();
                }
            }, 1000);
        } else if (type === 'game') {
            this.moveTimer = setInterval(() => {
                this.currentTimerSeconds--;
                this.updateGameTimer();
                
                if (this.currentTimerSeconds <= 0) {
                    this.clearTimer();
                    this.currentTimerSeconds = 0; // Prevent negative
                    // Auto-play first valid card if time runs out
                    this.autoPlayCard();
                }
            }, 1000);
        }
    }

    startMoveTimer(seconds) {
        this.currentTimerSeconds = seconds;
        this.moveTimer = setInterval(() => {
            this.currentTimerSeconds--;
            // Update any move timer displays here
            
            if (this.currentTimerSeconds <= 0) {
                this.clearTimer();
                // Auto-play first valid card if time runs out
                this.autoPlayCard();
            }
        }, 1000);
    }

    autoPlayCard() {
        if (this.gameState?.currentPlayer === this.playerIndex && this.playerHand.length > 0) {
            // Play the first valid card
            const validCard = this.validCards && this.validCards.length > 0 
                ? this.validCards[0] 
                : this.playerHand[0];
            this.playCard(validCard);
        }
    }

    autoBid() {
        if (this.gameState?.gamePhase === 'bidding' && this.gameState.currentPlayer === this.playerIndex) {
            // Place minimum bid
            this.placeBid(1);
        }
    }

    clearTimer() {
        if (this.bidTimer) {
            clearInterval(this.bidTimer);
            this.bidTimer = null;
        }
        if (this.moveTimer) {
            clearInterval(this.moveTimer);
            this.moveTimer = null;
        }
    }

    updateTimer(seconds, type) {
        this.currentTimerSeconds = seconds;
        if (type === 'bid') {
            this.updateBidTimer();
        } else if (type === 'game') {
            this.updateGameTimer();
        }
    }
    
    updateGameTimer() {
        const gameTimerElement = document.getElementById('game-timer');
        const gameTimerContainer = document.getElementById('game-timer-container');
        
        if (gameTimerElement && this.currentTimerSeconds !== undefined) {
            gameTimerElement.textContent = this.currentTimerSeconds;
            
            // Show timer during playing phase
            if (this.gameState?.gamePhase === 'playing') {
                gameTimerContainer.style.display = 'block';
            } else {
                gameTimerContainer.style.display = 'none';
            }
            
            // Add warning class if time is running low
            if (this.currentTimerSeconds <= 10) {
                gameTimerElement.classList.add('warning');
            } else {
                gameTimerElement.classList.remove('warning');
            }
        }
    }

    // === END NEW FEATURES ===

    updateGameDisplay() {
        if (!this.gameState) return;

        // Find player index
        this.playerIndex = this.gameState.players.findIndex(p => p.id === this.socket.id);
        
        // Show/hide host controls
        const isHost = this.gameState.hostId === this.socket.id;
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        
        if (isHost && this.gameState.gamePhase !== 'waiting' && this.gameState.gamePhase !== 'game_end') {
            pauseBtn.style.display = 'inline-block';
            stopBtn.style.display = 'inline-block';
            
            // Update pause button state
            if (this.gameState.isPaused) {
                pauseBtn.textContent = '▶️';
                pauseBtn.title = 'Resume Game';
            } else {
                pauseBtn.textContent = '⏸️';
                pauseBtn.title = 'Pause Game';
            }
        } else {
            pauseBtn.style.display = 'none';
            stopBtn.style.display = 'none';
        }
        
        // Hide host/join sections and start screen once game has started
        if (this.gameState.gamePhase !== 'waiting') {
            const hostSection = document.getElementById('host-section');
            const joinSection = document.getElementById('join-section');
            const startScreen = document.getElementById('start-screen');
            if (hostSection) hostSection.style.display = 'none';
            if (joinSection) joinSection.style.display = 'none';
            if (startScreen) startScreen.style.display = 'none';
        }
        
        // Update waiting screen
        this.updateWaitingScreen();
        
        // Update game screen based on phase
        if (this.gameState.gamePhase !== 'waiting') {
            this.showScreen('game-screen');
            this.updateGameScreen();
            
            // Reset sort cards button for new rounds
            if (this.gameState.gamePhase === 'bidding' && this.gameState.currentRound > 1) {
                this.sortCardsUsed = false;
                this.cardsAreSorted = false;
                document.getElementById('sort-cards-btn').disabled = false;
            }
        }
    }

    updateWaitingScreen() {
        const playersContainer = document.getElementById('players-container');
        playersContainer.innerHTML = '';
        
        // Hide host/join sections once all players have joined the arena
        if (this.gameState.players.length >= 4) {
            const hostSection = document.getElementById('host-section');
            const joinSection = document.getElementById('join-section');
            if (hostSection) hostSection.style.display = 'none';
            if (joinSection) joinSection.style.display = 'none';
        }
        
        this.gameState.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                <strong>${player.name}</strong>
                <span class="status-indicator status-active"></span>
            `;
            playersContainer.appendChild(playerDiv);
            
            // Update team slots
            if (index === 0) {
                document.getElementById('team1-player1').textContent = player.name;
                document.getElementById('team1-player1').classList.add('filled');
            } else if (index === 1) {
                document.getElementById('team2-player1').textContent = player.name;
                document.getElementById('team2-player1').classList.add('filled');
            } else if (index === 2) {
                document.getElementById('team1-player2').textContent = player.name;
                document.getElementById('team1-player2').classList.add('filled');
            } else if (index === 3) {
                document.getElementById('team2-player2').textContent = player.name;
                document.getElementById('team2-player2').classList.add('filled');
            }
        });
        
        if (this.gameState.players.length === 4) {
            document.getElementById('waiting-message').textContent = 'All players joined! Starting game...';
        } else {
            document.getElementById('waiting-message').textContent = 
                `Waiting for ${4 - this.gameState.players.length} more player(s)...`;
        }
    }

    updateGameScreen() {
        // Update header
        document.getElementById('current-round').textContent = this.gameState.currentRound;
        document.getElementById('max-rounds-display').textContent = this.gameState.maxRounds;
        document.getElementById('trump-suit').textContent = this.gameState.trump || '-';
        
        // Update phase indicator
        const phaseTexts = {
            'bidding': 'Bidding Phase',
            'trump_selection': 'Trump Selection',
            'playing': 'Playing Cards',
            'round_end': 'Round Complete',
            'game_end': 'Game Complete'
        };
        document.getElementById('phase-indicator').textContent = phaseTexts[this.gameState.gamePhase] || 'Unknown Phase';
        
        // Show appropriate section
        this.hideAllGameSections();
        
        switch (this.gameState.gamePhase) {
            case 'bidding':
                this.showGameSection('bidding-section');
                this.updateBiddingSection();
                break;
            case 'trump_selection':
                this.showGameSection('trump-section');
                this.updateTrumpSection();
                break;
            case 'playing':
                this.showGameSection('game-board');
                this.showGameSection('score-section');
                this.updateGameBoard();
                this.updateScoreSection();
                this.updateGameTimer(); // Show game timer during playing phase
                break;
            case 'round_end':
                this.showGameSection('round-end-section');
                this.showGameSection('score-section');
                this.updateRoundEndSection();
                this.updateScoreSection();
                break;
            case 'game_end':
                this.showGameSection('game-end-section');
                this.updateGameEndSection();
                break;
        }
    }

    updateBiddingSection() {
        // Update current bids display
        this.gameState.players.forEach((player, index) => {
            const bidElement = document.getElementById(`bid-player-${index}`);
            bidElement.textContent = `${player.name}: ${player.bid || '-'}`;
            bidElement.classList.toggle('current-player', index === this.gameState.currentPlayer);
        });
        
        // Update bid instruction
        const currentPlayerName = this.gameState.players[this.gameState.currentPlayer]?.name || 'Unknown';
        const isMyTurn = this.gameState.currentPlayer === this.playerIndex;
        
        if (isMyTurn) {
            document.getElementById('bid-instruction').textContent = 'It\'s your turn to bid!';
            this.showBidModal(); // Automatically show bid modal when it's player's turn
        } else {
            document.getElementById('bid-instruction').textContent = `Waiting for ${currentPlayerName} to bid...`;
            document.getElementById('bid-controls').style.display = 'none';
        }
    }

    updateTrumpSection() {
        const isMyTurn = this.gameState.bidWinningPlayer === this.playerIndex;
        const trumpPlayerName = this.gameState.players[this.gameState.bidWinningPlayer]?.name || 'Unknown';
        
        if (isMyTurn) {
            document.getElementById('trump-instruction').textContent = 'Choose the trump suit!';
            document.querySelectorAll('.trump-btn').forEach(btn => btn.disabled = false);
        } else {
            document.getElementById('trump-instruction').textContent = `Waiting for ${trumpPlayerName} to select trump...`;
            document.querySelectorAll('.trump-btn').forEach(btn => btn.disabled = true);
        }
    }

    updateGameBoard() {
        // Update turn indicator
        const currentPlayerName = this.gameState.players[this.gameState.currentPlayer]?.name || 'Unknown';
        const isMyTurn = this.gameState.currentPlayer === this.playerIndex;
        const turnIndicator = document.getElementById('current-turn-indicator');
        
        if (turnIndicator) {
            if (isMyTurn) {
                turnIndicator.textContent = "It's your turn!";
                turnIndicator.className = 'turn-indicator my-turn';
            } else {
                turnIndicator.textContent = `${currentPlayerName}'s turn`;
                turnIndicator.className = 'turn-indicator other-turn';
            }
        }
        
        // Update other players info - fix player name display
        let displayIndex = 1;
        this.gameState.players.forEach((player, index) => {
            if (index !== this.playerIndex) {
                const nameElement = document.getElementById(`player-${displayIndex}-name`);
                const cardsElement = document.getElementById(`player-${displayIndex}-cards`);
                const indicatorElement = document.getElementById(`player-${displayIndex}-indicator`);
                
                if (nameElement) nameElement.textContent = player.name || 'Unknown Player';
                if (cardsElement) {
                    // Get actual card count for this player
                    const cardCount = this.playerHand.length; // All players should have same count in sync
                    cardsElement.textContent = `${cardCount} cards`;
                }
                if (indicatorElement) {
                    indicatorElement.classList.toggle('current', index === this.gameState.currentPlayer);
                }
                displayIndex++;
            }
        });
        
        // Update trick area
        this.updateTrickArea();
    }

    updateTrickArea() {
        const trickCardsElement = document.getElementById('trick-cards');
        trickCardsElement.innerHTML = '';
        
        this.gameState.currentTrick.forEach(trickCard => {
            const cardElement = document.createElement('div');
            cardElement.className = 'trick-card';
            
            const img = document.createElement('img');
            img.src = `/assets/${trickCard.card.image}`;
            img.alt = `${trickCard.card.rank} of ${trickCard.card.suit}`;
            cardElement.appendChild(img);
            
            trickCardsElement.appendChild(cardElement);
        });
        
        // Update trick winner
        if (this.gameState.trickWinner !== null) {
            const winnerName = this.gameState.players[this.gameState.trickWinner]?.name;
            const winnerTeam = this.gameState.trickWinner % 2; // 0 or 2 -> team 0, 1 or 3 -> team 1
            
            // Get team names
            let teamNames;
            if (winnerTeam === 0) {
                teamNames = `${this.gameState.players[0]?.name || 'Player 1'} and ${this.gameState.players[2]?.name || 'Player 3'}`;
            } else {
                teamNames = `${this.gameState.players[1]?.name || 'Player 2'} and ${this.gameState.players[3]?.name || 'Player 4'}`;
            }
            
            // Calculate remaining tricks needed
            const winningTeamBid = this.gameState.bidWinningTeam === 0 ? 
                Math.max(this.gameState.players[0]?.bid || 0, this.gameState.players[2]?.bid || 0) :
                Math.max(this.gameState.players[1]?.bid || 0, this.gameState.players[3]?.bid || 0);
            
            let tricksNeeded = 0;
            if (this.gameState.bidWinningTeam === winnerTeam) {
                // Winner's team has the bid
                tricksNeeded = Math.max(0, winningTeamBid - this.gameState.tricksWon[winnerTeam]);
            } else {
                // Winner's team doesn't have the bid
                const requiredTricks = 14 - winningTeamBid;
                tricksNeeded = Math.max(0, requiredTricks - this.gameState.tricksWon[winnerTeam]);
            }
            
            const remainingMessage = tricksNeeded > 0 ? 
                `They need ${tricksNeeded} more trick${tricksNeeded > 1 ? 's' : ''} to win.` : 
                'They have enough tricks to win the round!';
            
            document.getElementById('trick-winner').textContent = 
                `${teamNames} won this trick! ${remainingMessage}`;
            
            // Show enhanced toast notification
            this.showToast(`🏆 ${teamNames} won the trick! ${remainingMessage}`, 3000);
        } else {
            document.getElementById('trick-winner').textContent = '';
        }
    }

    updateHandDisplay() {
        const handElement = document.getElementById('hand-cards');
        
        // Clear existing cards properly
        while (handElement.firstChild) {
            handElement.removeChild(handElement.firstChild);
        }

        // Ensure cards stay sorted if they were sorted
        if (this.cardsAreSorted) {
            this.playerHand.sort((a, b) => {
                if (a.suit !== b.suit) {
                    const suitOrder = ['clubs', 'diamonds', 'hearts', 'spades'];
                    return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
                }
                return a.value - b.value;
            });
        }
        
        this.playerHand.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            
            // Add animation delay for mobile card dealing
            if (this.isMobile) {
                cardElement.style.animationDelay = `${index * 0.1}s`;
                cardElement.classList.add('card-deal');
            }
            
            // Check if card is playable based on game rules
            const isCardValid = this.isCardPlayable(card);
            if (this.gameState?.gamePhase === 'playing' && this.gameState.currentPlayer === this.playerIndex && isCardValid) {
                cardElement.classList.add('playable');
                
                // Enhanced mobile card interaction
                const playCardHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Additional protection against multiple plays
                    if (this.isPlayingCard) {
                        return;
                    }
                    
                    // Check if player already played in current trick
                    const currentTrick = this.gameState?.currentTrick || [];
                    const playerAlreadyPlayed = currentTrick.some(trickCard => trickCard.playerId === this.playerIndex);
                    if (playerAlreadyPlayed) {
                        return;
                    }
                    
                    if (this.isMobile) {
                        // Add haptic feedback if available
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                        // Visual feedback
                        cardElement.style.transform = 'scale(1.1)';
                        setTimeout(() => {
                            this.playCard(card);
                            cardElement.style.transform = '';
                        }, 200);
                    } else {
                        this.playCard(card);
                    }
                };
                
                cardElement.addEventListener('click', playCardHandler, { once: true });
                
                // Add touch events for better mobile experience
                if (this.isMobile) {
                    cardElement.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        cardElement.style.transform = 'scale(1.05) translateY(-5px)';
                    }, { passive: false });
                    
                    cardElement.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        cardElement.style.transform = '';
                    });
                }
            }
            
            const img = document.createElement('img');
            img.src = `/assets/${card.image}`;
            img.alt = `${card.rank} of ${card.suit}`;
            img.loading = 'lazy'; // Optimize image loading
            cardElement.appendChild(img);
            
            handElement.appendChild(cardElement);
        });
        
        // Optimize card layout for mobile
        if (this.isMobile && this.playerHand.length > 10) {
            handElement.classList.add('many-cards');
        }
    }
    
    startCardDealingAnimation() {
        // Clear existing hand and prepare for card dealing
        this.playerHand = [];
        this.dealingCards = [];
        this.updateHandDisplay();
        
        // Show dealing message
        const handElement = document.getElementById('hand-cards');
        handElement.innerHTML = '<div class="dealing-message">Dealing cards...</div>';
    }

    addCardToHand(card, cardIndex, totalCards) {
        // Add card to dealing array first (unsorted)
        this.dealingCards[cardIndex] = card;
        
        // Create card element with dealing animation
        const handElement = document.getElementById('hand-cards');
        
        // Remove dealing message if this is the first card
        if (cardIndex === 0) {
            handElement.innerHTML = '';
        }
        
        const cardElement = document.createElement('div');
        cardElement.className = 'card dealing';
        cardElement.style.animationDelay = `${cardIndex * 0.05}s`; // Slight stagger for visual effect
        
        const img = document.createElement('img');
        img.src = `/assets/${card.image}`;
        img.alt = `${card.rank} of ${card.suit}`;
        img.loading = 'lazy';
        cardElement.appendChild(img);
        
        handElement.appendChild(cardElement);
        
        // If this is the last card, prepare for sorting
        if (cardIndex === totalCards - 1) {
            this.playerHand = [...this.dealingCards];
        }
    }

    startSortingAnimation() {
        // Show sorting message
        const handElement = document.getElementById('hand-cards');
        const sortingMessage = document.createElement('div');
        sortingMessage.className = 'sorting-message';
        sortingMessage.textContent = 'Sorting cards...';
        handElement.appendChild(sortingMessage);
        
        // Start insertion sort animation
        this.animateInsertionSort();
    }

    animateInsertionSort() {
        // Sort cards first
        this.sortCards();
        
        // Get card elements
        const cardElements = Array.from(document.querySelectorAll('#hand-cards .card'));
        
        // Hide all cards initially except the first one
        cardElements.forEach((card, index) => {
            if (index > 0) {
                card.style.opacity = '0.3';
                card.style.transform = 'translateY(20px)';
            }
        });
        
        // Animate cards one by one (insertion sort style)
        let currentIndex = 1;
        const animateNext = () => {
            if (currentIndex >= cardElements.length) {
                // Animation complete
                setTimeout(() => this.completeSorting(), 500);
                return;
            }
            
            const currentCard = cardElements[currentIndex];
            
            // Animate current card into position
            currentCard.style.transition = 'all 0.5s ease-out';
            currentCard.style.opacity = '1';
            currentCard.style.transform = 'translateY(0)';
            
            // Add sorting effect
            currentCard.style.animation = 'cardInsertSort 0.5s ease-out';
            
            currentIndex++;
            setTimeout(animateNext, 600); // Wait for animation to complete
        };
        
        // Start animation after a brief delay
        setTimeout(animateNext, 1000);
    }

    completeSorting() {
        // Remove sorting message and update display
        const sortingMessage = document.querySelector('.sorting-message');
        if (sortingMessage) {
            sortingMessage.remove();
        }
        
        // Final sorted display
        this.updateHandDisplay();
    }
    
    isCardPlayable(card) {
        // If no valid cards info, allow all cards (fallback)
        if (!this.validCards || this.validCards.length === 0) {
            return true;
        }
        
        // Check if this card is in the list of valid cards
        const isValid = this.validCards.some(validCard => 
            validCard.suit === card.suit && validCard.rank === card.rank
        );
        
        return isValid;
    }

    updateScoreSection() {
        if (!this.gameState) return;
        
        // Calculate team bids (use MAX, not sum)
        let team1Bid = 0, team2Bid = 0;
        const player0Bid = this.gameState.players[0]?.bid || 0;
        const player2Bid = this.gameState.players[2]?.bid || 0;
        const player1Bid = this.gameState.players[1]?.bid || 0;
        const player3Bid = this.gameState.players[3]?.bid || 0;
        
        team1Bid = Math.max(player0Bid, player2Bid);
        team2Bid = Math.max(player1Bid, player3Bid);
        
        // Get team names
        const team1Names = `${this.gameState.players[0]?.name || 'Player 1'} & ${this.gameState.players[2]?.name || 'Player 3'}`;
        const team2Names = `${this.gameState.players[1]?.name || 'Player 2'} & ${this.gameState.players[3]?.name || 'Player 4'}`;
        
        // Calculate tricks needed for each team
        const winningTeamBid = this.gameState.bidWinningTeam === 0 ? team1Bid : team2Bid;
        let team1TricksNeeded = 0, team2TricksNeeded = 0;
        
        if (this.gameState.bidWinningTeam === 0) {
            // Team 1 has the bid
            team1TricksNeeded = Math.max(0, winningTeamBid - this.gameState.tricksWon[0]);
            team2TricksNeeded = Math.max(0, (14 - winningTeamBid) - this.gameState.tricksWon[1]);
        } else {
            // Team 2 has the bid
            team1TricksNeeded = Math.max(0, (14 - winningTeamBid) - this.gameState.tricksWon[0]);
            team2TricksNeeded = Math.max(0, winningTeamBid - this.gameState.tricksWon[1]);
        }
        
        // Update scorecard with enhanced info
        document.getElementById('team1-bid').textContent = team1Bid || '-';
        document.getElementById('team2-bid').textContent = team2Bid || '-';
        document.getElementById('team1-tricks').textContent = 
            `${this.gameState.tricksWon[0]} (need ${team1TricksNeeded} more)`;
        document.getElementById('team2-tricks').textContent = 
            `${this.gameState.tricksWon[1]} (need ${team2TricksNeeded} more)`;
        
        // Update scorecard with enhanced info
        document.getElementById('team1-bid').textContent = team1Bid || '-';
        document.getElementById('team2-bid').textContent = team2Bid || '-';
        document.getElementById('team1-tricks').textContent = 
            `${this.gameState.tricksWon[0]} (need ${team1TricksNeeded} more)`;
        document.getElementById('team2-tricks').textContent = 
            `${this.gameState.tricksWon[1]} (need ${team2TricksNeeded} more)`;
        
        // Update team labels with player names by finding parent elements
        const team1BidParent = document.getElementById('team1-bid').parentElement;
        const team2BidParent = document.getElementById('team2-bid').parentElement;
        const team1TricksParent = document.getElementById('team1-tricks').parentElement;
        const team2TricksParent = document.getElementById('team2-tricks').parentElement;
        
        if (team1BidParent) {
            team1BidParent.innerHTML = `${team1Names} Bid: <span id="team1-bid">${team1Bid || '-'}</span>`;
        }
        if (team2BidParent) {
            team2BidParent.innerHTML = `${team2Names} Bid: <span id="team2-bid">${team2Bid || '-'}</span>`;
        }
        if (team1TricksParent) {
            team1TricksParent.innerHTML = `${team1Names} Tricks: <span id="team1-tricks">${this.gameState.tricksWon[0]} (need ${team1TricksNeeded} more)</span>`;
        }
        if (team2TricksParent) {
            team2TricksParent.innerHTML = `${team2Names} Tricks: <span id="team2-tricks">${this.gameState.tricksWon[1]} (need ${team2TricksNeeded} more)</span>`;
        }
        
        // Update rounds won from gameState
        if (this.gameState.roundsWon) {
            document.getElementById('team1-overall').textContent = this.gameState.roundsWon[0];
            document.getElementById('team2-overall').textContent = this.gameState.roundsWon[1];
        } else {
            // Fallback: Calculate from roundScores
            let team1Wins = 0, team2Wins = 0;
            this.gameState.roundScores.forEach(score => {
                if (score.winner === 0) team1Wins++;
                else team2Wins++;
            });
            document.getElementById('team1-overall').textContent = team1Wins;
            document.getElementById('team2-overall').textContent = team2Wins;
        }
    }

    updateRoundEndSection() {
        const lastRound = this.gameState.roundScores[this.gameState.roundScores.length - 1];
        if (!lastRound) return;
        
        const roundResult = document.getElementById('round-result');
        const winnerTeam = lastRound.winner === 0 ? 'Team 1' : 'Team 2';
        const biddingTeam = lastRound.bidWinningTeam + 1;
        
        // Determine why the team won
        let explanation = '';
        if (lastRound.bidWinningTeam === 0) {
            // Team 1 bid higher
            if (lastRound.team1Tricks >= lastRound.team1Bid) {
                explanation = `Team 1 made their bid (needed at least ${lastRound.team1Bid}, got ${lastRound.team1Tricks} tricks)`;
            } else {
                explanation = `Team 1 failed their bid (needed at least ${lastRound.team1Bid}, got only ${lastRound.team1Tricks} tricks)`;
            }
        } else {
            // Team 2 bid higher  
            if (lastRound.team2Tricks >= lastRound.team2Bid) {
                explanation = `Team 2 made their bid (needed at least ${lastRound.team2Bid}, got ${lastRound.team2Tricks} tricks)`;
            } else {
                explanation = `Team 2 failed their bid (needed at least ${lastRound.team2Bid}, got only ${lastRound.team2Tricks} tricks)`;
            }
        }
        
        // Get winner names
        let winnerNames;
        if (lastRound.winner === 0) {
            winnerNames = `${this.gameState.players[0]?.name || 'Player 1'} and ${this.gameState.players[2]?.name || 'Player 3'}`;
        } else {
            winnerNames = `${this.gameState.players[1]?.name || 'Player 2'} and ${this.gameState.players[3]?.name || 'Player 4'}`;
        }
        
        roundResult.innerHTML = `
            <h3>Round ${lastRound.round} Results</h3>
            <p><strong>🎉 ${winnerNames} won the round! 🎉</strong></p>
            <p><em>${explanation}</em></p>
            <p>Team 1 Bid: ${lastRound.team1Bid} | Tricks Won: ${lastRound.team1Tricks}</p>
            <p>Team 2 Bid: ${lastRound.team2Bid} | Tricks Won: ${lastRound.team2Tricks}</p>
            <p>Bidding Team: Team ${biddingTeam}</p>
        `;
        
        // Show winner announcement toast
        this.showToast(`🏆 Round ${lastRound.round}: ${winnerNames} won!`, 3000);
        
        // Show next round button only to first player
        document.getElementById('next-round-btn').style.display = 
            this.playerIndex === 0 ? 'block' : 'none';
    }

    updateGameEndSection() {
        // Use roundsWon from gameState or calculate from roundScores
        let team1Wins, team2Wins;
        if (this.gameState.roundsWon) {
            team1Wins = this.gameState.roundsWon[0];
            team2Wins = this.gameState.roundsWon[1];
        } else {
            team1Wins = 0;
            team2Wins = 0;
            this.gameState.roundScores.forEach(score => {
                if (score.winner === 0) team1Wins++;
                else team2Wins++;
            });
        }
        
        const finalResult = document.getElementById('final-result');
        const gameWinner = team1Wins > team2Wins ? 'Team 1' : 
                          team2Wins > team1Wins ? 'Team 2' : 'Tie';
        
        // Get winning team player names
        let winnerNames = '';
        if (gameWinner === 'Team 1') {
            winnerNames = `${this.gameState.players[0]?.name || 'Player 1'} and ${this.gameState.players[2]?.name || 'Player 3'}`;
        } else if (gameWinner === 'Team 2') {
            winnerNames = `${this.gameState.players[1]?.name || 'Player 2'} and ${this.gameState.players[3]?.name || 'Player 4'}`;
        }
        
        finalResult.innerHTML = `
            <h3>🎉 Game Complete! 🎉</h3>
            <div class="winner-announcement">
                <h2 style="color: gold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
                    ${gameWinner === 'Tie' ? 'It\'s a Tie!' : `${winnerNames} WON!`}
                </h2>
            </div>
            <p><strong>Final Score:</strong></p>
            <p>Team 1: ${team1Wins} rounds won</p>
            <p>Team 2: ${team2Wins} rounds won</p>
            <div style="margin-top: 1rem;">
                <h4>Round Summary:</h4>
                ${this.gameState.roundScores.map(score => 
                    `<p>Round ${score.round}: Team ${score.winner + 1} won</p>`
                ).join('')}
            </div>
        `;
        
        // Show winner announcement for 10 seconds
        if (gameWinner !== 'Tie') {
            this.showToast(`🏆 ${winnerNames} have won the game! 🏆`, 10000);
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        
        // Hide start screen completely when showing waiting screen
        if (screenId === 'waiting-screen' || screenId === 'game-screen') {
            document.getElementById('start-screen').style.display = 'none';
        }
    }

    hideAllGameSections() {
        document.querySelectorAll('.game-section').forEach(section => {
            section.classList.remove('active');
        });
    }

    showGameSection(sectionId) {
        document.getElementById(sectionId).classList.add('active');
    }

    updateConnectionStatus(status, text) {
        const indicator = document.getElementById('connection-indicator');
        const statusText = document.getElementById('connection-text');
        
        if (indicator && statusText) {
            indicator.className = status;
            statusText.textContent = text;
        }
    }

    clearGameBoard() {
        // Clear current trick display
        document.getElementById('trick-cards').innerHTML = '';
        document.getElementById('trick-winner').textContent = '';
        
        // Clear player hands display
        document.getElementById('hand-cards').innerHTML = '';
        
        // Reset trump display
        document.getElementById('trump-suit').textContent = '-';
        
        // Clear phase indicator
        document.getElementById('phase-indicator').textContent = 'Preparing next round...';
    }

    startRoundCountdown(seconds, nextRound) {
        let remainingSeconds = seconds;
        const phaseIndicator = document.getElementById('phase-indicator');
        
        const countdownInterval = setInterval(() => {
            phaseIndicator.textContent = `Round ${nextRound} starting in ${remainingSeconds}...`;
            remainingSeconds--;
            
            if (remainingSeconds < 0) {
                clearInterval(countdownInterval);
                phaseIndicator.textContent = `Round ${nextRound} - Dealing cards...`;
            }
        }, 1000);
    }

    returnToStartScreen() {
        // Clear all game data
        this.gameState = null;
        this.playerHand = [];
        this.playerIndex = -1;
        this.gameCode = '';
        
        // Show start screen and hide others
        document.getElementById('start-screen').style.display = 'block';
        this.showScreen('start-screen');
        
        // Clear form inputs
        document.getElementById('host-name').value = '';
        document.getElementById('join-name').value = '';
        document.getElementById('game-code').value = '';
        document.getElementById('max-rounds').value = '7';
        
        // Returned to start screen
    }

    pauseGame() {
        this.socket.emit('pause_game');
    }

    stopGame() {
        if (confirm('Are you sure you want to stop the game? This will end the current game and return all players to the start screen.')) {
            this.socket.emit('stop_game');
        }
    }

    handleGamePaused(data) {
        const pauseBtn = document.getElementById('pause-btn');
        const phaseIndicator = document.getElementById('phase-indicator');
        
        if (data.isPaused) {
            pauseBtn.textContent = '▶️'; // Play button when paused
            pauseBtn.title = 'Resume Game';
            phaseIndicator.textContent = `Game paused by ${data.pausedBy}`;
            phaseIndicator.style.color = '#ff6b6b';
            
            // Show pause overlay
            this.showPauseOverlay(data.pausedBy);
        } else {
            pauseBtn.textContent = '⏸️'; // Pause button when playing
            pauseBtn.title = 'Pause Game';
            phaseIndicator.style.color = '';
            
            // Hide pause overlay
            this.hidePauseOverlay();
        }
    }

    handlePlayerDisconnected(data) {
        // Show notification about player leaving
        const playerName = data.playerName || 'A player';
        this.showToast(`${playerName} has left the game`, 3000);
        
        // Update UI if needed
        if (data.playersRemaining < 4 && this.gameState && this.gameState.gamePhase !== 'waiting') {
            this.showToast('Game paused due to player disconnect', 3000);
        }
    }

    handleGameStopped(data) {
        // Show game stopped message
        this.showToast(`Game stopped by ${data.stoppedBy}`, 3000);
        
        // Game will automatically return to start screen via gameEnded event
    }

    showPauseOverlay(pausedBy) {
        // Create or show pause overlay
        let overlay = document.getElementById('pause-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pause-overlay';
            overlay.className = 'pause-overlay';
            overlay.innerHTML = `
                <div class="pause-content">
                    <div class="pause-icon">⏸️</div>
                    <h2>Game Paused</h2>
                    <p>Game paused by ${pausedBy}</p>
                    <p>Waiting for host to resume...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    hidePauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showRoundEndScreen(data) {
        // Clear the board and show round end screen
        this.clearGameBoard();
        
        let overlay = document.getElementById('round-end-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'round-end-overlay';
            overlay.className = 'round-end-overlay';
            document.body.appendChild(overlay);
        }

        // Build statistics display
        let statsHtml = '<div class="round-stats">';
        if (data.roundStats && data.roundStats.length > 0) {
            statsHtml += '<h4>Round Statistics:</h4>';
            data.roundStats.forEach(stat => {
                statsHtml += `<p><strong>${stat.playerName}:</strong> ${stat.tricksWon} tricks won</p>`;
            });
        }
        
        if (data.overallStats && data.overallStats.length > 0) {
            statsHtml += '<h4>Overall Statistics:</h4>';
            data.overallStats.forEach(stat => {
                statsHtml += `<p><strong>${stat.playerName}:</strong> ${stat.totalTricks} total tricks</p>`;
            });
        }
        statsHtml += '</div>';

        overlay.innerHTML = `
            <div class="round-end-content">
                <div class="celebration-icon">🎉</div>
                <h2>Round ${data.roundNumber} Complete!</h2>
                <p><strong>Winner:</strong> ${data.winnerName}</p>
                <div class="scorecard">
                    <h3>Scorecard</h3>
                    ${this.buildScoreDisplay(data.scorecard)}
                </div>
                ${statsHtml}
                <div class="countdown-section">
                    <h3>Next round starting in <span id="round-countdown">10</span> seconds...</h3>
                </div>
            </div>
        `;
        
        overlay.style.display = 'flex';
        
        // Start countdown
        let countdown = 10;
        const countdownElement = document.getElementById('round-countdown');
        const timer = setInterval(() => {
            countdown--;
            if (countdownElement) {
                countdownElement.textContent = countdown;
            }
            if (countdown <= 0) {
                clearInterval(timer);
                overlay.style.display = 'none';
            }
        }, 1000);
    }

    showGameEndScreen(data) {
        // Clear the board and show game end screen
        this.clearGameBoard();
        
        let overlay = document.getElementById('game-end-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'game-end-overlay';
            overlay.className = 'game-end-overlay';
            document.body.appendChild(overlay);
        }

        // Build comprehensive statistics
        let statsHtml = '<div class="game-stats">';
        if (data.playerStats && data.playerStats.length > 0) {
            statsHtml += '<h4>Final Statistics:</h4>';
            data.playerStats.forEach(stat => {
                statsHtml += `<p><strong>${stat.playerName}:</strong> ${stat.totalTricks} tricks across ${data.totalRounds} rounds</p>`;
            });
        }
        
        if (data.roundScores && data.roundScores.length > 0) {
            statsHtml += '<h4>Round History:</h4>';
            data.roundScores.forEach((round, index) => {
                statsHtml += `<p><strong>Round ${index + 1}:</strong> `;
                round.forEach(score => {
                    statsHtml += `${score.playerName}: ${score.score} | `;
                });
                statsHtml = statsHtml.slice(0, -3) + '</p>'; // Remove last " | "
            });
        }
        statsHtml += '</div>';

        overlay.innerHTML = `
            <div class="game-end-content">
                <div class="victory-icon">🏆</div>
                <h1>Game Complete!</h1>
                <h2><strong>Winner:</strong> ${data.winnerName}</h2>
                <div class="final-scorecard">
                    <h3>Final Scorecard</h3>
                    ${this.buildScoreDisplay(data.finalScorecard)}
                </div>
                ${statsHtml}
                <div class="game-end-actions">
                    <button onclick="location.reload()" class="new-game-btn">New Game</button>
                </div>
            </div>
        `;
        
        overlay.style.display = 'flex';
    }

    buildScoreDisplay(scorecard) {
        if (!scorecard || scorecard.length === 0) return '<p>No scores available</p>';
        
        let html = '<table class="score-table">';
        html += '<thead><tr><th>Player</th><th>Score</th></tr></thead><tbody>';
        
        scorecard.forEach(player => {
            html += `<tr><td>${player.playerName}</td><td>${player.score}</td></tr>`;
        });
        
        html += '</tbody></table>';
        return html;
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').style.display = 'block';
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new JudgementGame();
});
