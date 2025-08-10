const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

console.log('Starting Judgement Card Game Server...');

const app = express();
const server = http.createServer(app);

console.log('Creating Socket.IO instance...');
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(path.join(__dirname, '../Assets')));

// Game state storage
const games = new Map();
const players = new Map();

// Game configuration
const CARDS_PER_PLAYER = 13;
const MIN_BID = 6;
const MAX_BID = 13;

// Card deck setup
const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];

function createDeck() {
    const deck = [];
    suits.forEach(suit => {
        ranks.forEach(rank => {
            deck.push({
                suit,
                rank,
                value: getRankValue(rank),
                image: `${rank}_of_${suit}.svg`
            });
        });
    });
    return deck;
}

function getRankValue(rank) {
    const values = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
    };
    return values[rank] || 0;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(deck) {
    const hands = [[], [], [], []];
    for (let i = 0; i < CARDS_PER_PLAYER; i++) {
        for (let j = 0; j < 4; j++) {
            hands[j].push(deck[i * 4 + j]);
        }
    }
    return hands;
}

class Game {
    constructor(gameCode, maxRounds, io) {
        this.gameCode = gameCode;
        this.maxRounds = maxRounds;
        this.io = io; // Store the io instance
        this.players = [];
        this.currentRound = 0;
        this.currentPlayer = 0;
        this.gamePhase = 'waiting'; // waiting, bidding, trump_selection, playing, round_end, game_end
        this.bids = [];
        this.trump = null;
        this.currentTrick = [];
        this.trickWinner = null;
        this.tricksWon = [0, 0]; // Team 1 (players 0,2) and Team 2 (players 1,3)
        this.roundsWon = [0, 0]; // Track rounds won by each team
        this.roundScores = [];
        this.hands = [];
        this.bidWinningTeam = null;
        this.bidWinningPlayer = null;
        this.leadPlayer = 0;
        this.timer = null;
        this.timerDuration = 30000; // 30 seconds
        this.isPaused = false; // Game pause state
        this.hostId = null; // Track who the host is
        this.playerStats = [
            { tricksWon: 0, roundsParticipated: 0 },
            { tricksWon: 0, roundsParticipated: 0 },
            { tricksWon: 0, roundsParticipated: 0 },
            { tricksWon: 0, roundsParticipated: 0 }
        ]; // Track individual player statistics
        this.currentRoundStats = [0, 0, 0, 0]; // Tricks won by each player in current round
    }

    addPlayer(playerId, playerName) {
        if (this.players.length >= 4) return false;
        
        // Set the first player as host
        if (this.players.length === 0) {
            this.hostId = playerId;
        }
        
        this.players.push({
            id: playerId,
            name: playerName,
            hand: [],
            bid: null
        });

        if (this.players.length === 4) {
            this.startGame();
        }

        return true;
    }

    pauseGame(playerId) {
        // Only host can pause the game
        if (playerId !== this.hostId) {
            return false;
        }

        if (this.gamePhase === 'game_end' || this.gamePhase === 'waiting') {
            return false; // Cannot pause if game hasn't started or already ended
        }

        this.isPaused = !this.isPaused;
        
        // Clear any running timers when pausing
        if (this.isPaused) {
            this.clearTimer();
        }

        // Broadcast pause state to all players
        this.io.to(this.gameCode).emit('gamePaused', { 
            isPaused: this.isPaused,
            pausedBy: this.players.find(p => p.id === playerId)?.name || 'Host'
        });

        return true;
    }

    stopGame(playerId) {
        // Only host can stop the game
        if (playerId !== this.hostId) {
            return false;
        }

        // Clear any running timers
        this.clearTimer();

        // Broadcast game stopped to all players
        this.io.to(this.gameCode).emit('gameStopped', {
            stoppedBy: this.players.find(p => p.id === playerId)?.name || 'Host'
        });

        return true;
    }

    isHost(playerId) {
        return playerId === this.hostId;
    }

    startGame() {
        this.gamePhase = 'dealing';
        this.currentRound = 1;
        this.dealNewRound();
    }

    dealNewRound() {
        const deck = shuffleDeck(createDeck());
        this.hands = dealCards(deck);
        
        // Assign hands to players
        this.players.forEach((player, index) => {
            player.hand = this.hands[index];
            player.bid = null;
        });

        this.bids = [];
        this.currentTrick = [];
        this.tricksWon = [0, 0];
        this.trump = null;
        this.bidWinningTeam = null;
        this.bidWinningPlayer = null;
        this.leadPlayer = (this.currentRound - 1) % 4;
        this.currentPlayer = this.leadPlayer;
        this.gamePhase = 'dealing'; // Start in dealing phase
    }
    
    startCardDealing(gameCode) {
        // Send card dealing started event
        io.to(gameCode).emit('card_dealing_started');
        
        let cardIndex = 0;
        const totalCards = CARDS_PER_PLAYER * 4;
        
        const dealInterval = setInterval(() => {
            if (cardIndex >= totalCards) {
                clearInterval(dealInterval);
                // All cards dealt, start sorting animation
                this.startSortingAnimation(gameCode);
                return;
            }
            
            const playerIndex = cardIndex % 4;
            const cardInHand = Math.floor(cardIndex / 4);
            const card = this.players[playerIndex].hand[cardInHand];
            
            // Send individual card to player
            io.to(this.players[playerIndex].id).emit('card_dealt', {
                card: card,
                cardIndex: cardInHand,
                totalCards: CARDS_PER_PLAYER
            });
            
            cardIndex++;
        }, 250); // 0.25 seconds between each card
    }
    
    startSortingAnimation(gameCode) {
        // Send sorting started event to all players
        io.to(gameCode).emit('sorting_started');
        
        // After 10 seconds of sorting, proceed to bidding
        setTimeout(() => {
            this.gamePhase = 'bidding';
            io.to(gameCode).emit('sorting_completed');
            io.to(gameCode).emit('game_state', this.getGameState());
            
            // Send complete hands to each player
            this.players.forEach((player, index) => {
                io.to(player.id).emit('hand_update', this.getPlayerHand(player.id));
            });
            
            // Start bidding timer
            startBiddingTimer(this, gameCode);
        }, 10000); // 10 seconds for sorting
    }

    placeBid(playerId, bidAmount) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.currentPlayer) return false;
        if (bidAmount < MIN_BID || bidAmount > MAX_BID) return false;
        if (this.gamePhase !== 'bidding') return false;

        this.clearTimer(); // Clear any existing timer
        this.players[playerIndex].bid = bidAmount;
        this.currentPlayer = (this.currentPlayer + 1) % 4;

        // Check if all players have bid
        if (this.players.every(p => p.bid !== null)) {
            this.determineBidWinner();
        }

        return true;
    }

    determineBidWinner() {
        const team1Bid = this.players[0].bid + this.players[2].bid;
        const team2Bid = this.players[1].bid + this.players[3].bid;

        if (team1Bid > team2Bid) {
            this.bidWinningTeam = 0;
            // If both players bid the same, the later player (index 2) gets trump
            this.bidWinningPlayer = this.players[0].bid > this.players[2].bid ? 0 : 2;
        } else if (team2Bid > team1Bid) {
            this.bidWinningTeam = 1;
            // If both players bid the same, the later player (index 3) gets trump
            this.bidWinningPlayer = this.players[1].bid > this.players[3].bid ? 1 : 3;
        } else {
            // Tie - give it to the team that bid first (Team 1 has position advantage)
            this.bidWinningTeam = 0;
            this.bidWinningPlayer = this.players[0].bid > this.players[2].bid ? 0 : 2;
        }

        this.gamePhase = 'trump_selection';
        this.currentPlayer = this.bidWinningPlayer;
    }

    getWinningTeamBid() {
        if (this.bidWinningTeam === 0) {
            return Math.max(this.players[0].bid, this.players[2].bid);
        } else {
            return Math.max(this.players[1].bid, this.players[3].bid);
        }
    }

    selectTrump(playerId, trumpSuit) {
        if (this.gamePhase !== 'trump_selection') return false;
        if (this.players[this.bidWinningPlayer].id !== playerId) return false;

        this.trump = trumpSuit;
        this.gamePhase = 'playing';
        this.currentPlayer = this.bidWinningPlayer; // Bid winner starts the round
        this.currentTrick = [];

        return true;
    }

    playCard(playerId, card) {
        // Check if game is paused
        if (this.isPaused) return false;
        
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.currentPlayer) return false;
        if (this.gamePhase !== 'playing') return false;

        const player = this.players[playerIndex];
        const cardIndex = player.hand.findIndex(c => 
            c.suit === card.suit && c.rank === card.rank
        );
        
        if (cardIndex === -1) return false;
        
        // Validate if the card can be played according to game rules
        if (!this.isValidPlay(player, card)) return false;

        // Remove card from player's hand
        const playedCard = player.hand.splice(cardIndex, 1)[0];
        
        this.currentTrick.push({
            player: playerIndex,
            card: playedCard
        });

        if (this.currentTrick.length === 4) {
            this.processTrick();
        } else {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
        }

        return true;
    }
    
    getValidCards(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.currentPlayer) return [];
        if (this.gamePhase !== 'playing') return [];
        
        const player = this.players[playerIndex];
        
        // If this is the first card of the trick, all cards are valid
        if (this.currentTrick.length === 0) {
            console.log(`Player ${playerIndex} can play any card (first of trick)`);
            return player.hand;
        }
        
        // Get the lead suit
        const leadSuit = this.currentTrick[0].card.suit;
        console.log(`Lead suit is ${leadSuit}`);
        
        // Check if player has cards of the lead suit
        const leadSuitCards = player.hand.filter(c => c.suit === leadSuit);
        
        // If player has lead suit cards, they must play one
        if (leadSuitCards.length > 0) {
            console.log(`Player ${playerIndex} must play ${leadSuit}, has ${leadSuitCards.length} cards`);
            return leadSuitCards;
        }
        
        // If player doesn't have lead suit, they can play any card
        console.log(`Player ${playerIndex} has no ${leadSuit}, can play any card`);
        return player.hand;
    }

    isValidPlay(player, card) {
        // If this is the first card of the trick, any card is valid
        if (this.currentTrick.length === 0) return true;
        
        // Get the lead suit (first card played in the trick)
        const leadSuit = this.currentTrick[0].card.suit;
        
        // If player is playing the lead suit, it's valid
        if (card.suit === leadSuit) return true;
        
        // If player doesn't have the lead suit, they can play any card
        const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
        return !hasLeadSuit;
    }

    processTrick() {
        const trickWinner = this.determineTrickWinner();
        this.trickWinner = trickWinner;

        // Award trick to winning team
        const winningTeam = trickWinner % 2; // 0 or 2 -> team 0, 1 or 3 -> team 1
        this.tricksWon[winningTeam]++;
        
        // Track individual player statistics
        this.currentRoundStats[trickWinner]++;
        this.playerStats[trickWinner].tricksWon++;

        // Check if round should end immediately (someone won enough tricks)
        const winningTeamBid = this.getWinningTeamBid();
        const requiredTricksForOtherTeam = 14 - winningTeamBid;
        
        let roundWinner = null;
        let roundEndReason = '';
        
        if (this.bidWinningTeam === 0) {
            // Team 1 won the bid
            if (this.tricksWon[0] >= winningTeamBid) {
                roundWinner = 0;
                roundEndReason = `Team 1 has made their bid of ${winningTeamBid} tricks!`;
            } else if (this.tricksWon[1] >= requiredTricksForOtherTeam) {
                roundWinner = 1;
                roundEndReason = `Team 2 has prevented Team 1 from making their bid!`;
            }
        } else {
            // Team 2 won the bid
            if (this.tricksWon[1] >= winningTeamBid) {
                roundWinner = 1;
                roundEndReason = `Team 2 has made their bid of ${winningTeamBid} tricks!`;
            } else if (this.tricksWon[0] >= requiredTricksForOtherTeam) {
                roundWinner = 0;
                roundEndReason = `Team 1 has prevented Team 2 from making their bid!`;
            }
        }

        // Broadcast trick result
        this.io.to(this.gameCode).emit('trickCompleted', {
            winner: trickWinner,
            winnerName: this.players[trickWinner].name,
            tricksWon: this.tricksWon,
            trickJustCompleted: true
        });

        if (this.players[0].hand.length === 0 || roundWinner !== null) {
            // Round is complete - end immediately with reason
            if (roundWinner !== null && this.players[0].hand.length > 0) {
                // Early round end due to team reaching required tricks
                this.io.to(this.gameCode).emit('chatMessage', {
                    message: roundEndReason,
                    sender: 'Game',
                    timestamp: Date.now()
                });
            }
            
            setTimeout(() => {
                this.endRound();
            }, 5000); // 5 second buffer as requested
        } else {
            // Continue round - announce trick winner and clear trick after delay
            setTimeout(() => {
                this.currentPlayer = trickWinner;
                this.currentTrick = [];
                this.trickWinner = null;
            }, 2000); // 2 second delay to show trick winner
        }
    }

    determineTrickWinner() {
        const leadSuit = this.currentTrick[0].card.suit;
        let highestCard = this.currentTrick[0];
        let winner = this.currentTrick[0].player;

        for (let i = 1; i < this.currentTrick.length; i++) {
            const currentCard = this.currentTrick[i];
            
            if (this.isHigherCard(currentCard.card, highestCard.card, leadSuit)) {
                highestCard = currentCard;
                winner = currentCard.player;
            }
        }

        return winner;
    }

    isHigherCard(card1, card2, leadSuit) {
        // Trump cards beat non-trump cards
        if (card1.suit === this.trump && card2.suit !== this.trump) return true;
        if (card2.suit === this.trump && card1.suit !== this.trump) return false;

        // Both trump or both non-trump
        if (card1.suit === card2.suit) {
            return card1.value > card2.value;
        }

        // Different suits, neither trump - follow suit wins
        if (card1.suit === leadSuit && card2.suit !== leadSuit) return true;
        if (card2.suit === leadSuit && card1.suit !== leadSuit) return false;

        // Neither follows suit, first played wins
        return false;
    }

    endRound() {
        const team1Bid = Math.max(this.players[0].bid, this.players[2].bid);
        const team2Bid = Math.max(this.players[1].bid, this.players[3].bid);
        const winningTeamBid = this.getWinningTeamBid();
        const requiredTricksForOtherTeam = 14 - winningTeamBid;

        let roundWinner;
        // The team that won the bidding must make at least their max bid to win the round
        // The other team needs to make 14 - winningBid tricks to win
        if (this.bidWinningTeam === 0) {
            // Team 1 won the bid - they must make at least winningTeamBid tricks
            if (this.tricksWon[0] >= winningTeamBid) {
                roundWinner = 0; // Team 1 wins
            } else if (this.tricksWon[1] >= requiredTricksForOtherTeam) {
                roundWinner = 1; // Team 2 wins by making enough tricks
            } else {
                roundWinner = 0; // Team 1 wins by default if neither condition met
            }
        } else {
            // Team 2 won the bid - they must make at least winningTeamBid tricks
            if (this.tricksWon[1] >= winningTeamBid) {
                roundWinner = 1; // Team 2 wins
            } else if (this.tricksWon[0] >= requiredTricksForOtherTeam) {
                roundWinner = 0; // Team 1 wins by making enough tricks
            } else {
                roundWinner = 1; // Team 2 wins by default if neither condition met
            }
        }

        this.roundScores.push({
            round: this.currentRound,
            winner: roundWinner,
            team1Bid,
            team2Bid,
            team1Tricks: this.tricksWon[0],
            team2Tricks: this.tricksWon[1],
            bidWinningTeam: this.bidWinningTeam,
            winningTeamBid: winningTeamBid,
            requiredTricksForOtherTeam: requiredTricksForOtherTeam
        });

        // Update rounds won
        this.roundsWon[roundWinner]++;

        // Update player round participation stats
        this.playerStats.forEach(stat => stat.roundsParticipated++);

        // Prepare round end statistics
        const roundEndData = {
            roundWinner: roundWinner,
            roundWinnerTeam: roundWinner === 0 ? 'Team 1' : 'Team 2',
            roundWinnerPlayers: roundWinner === 0 ? 
                `${this.players[0].name} & ${this.players[2].name}` : 
                `${this.players[1].name} & ${this.players[3].name}`,
            currentRound: this.currentRound,
            roundStats: {
                tricksWonThisRound: [...this.currentRoundStats],
                playerNames: this.players.map(p => p.name),
                team1Tricks: this.tricksWon[0],
                team2Tricks: this.tricksWon[1],
                team1Bid: Math.max(this.players[0].bid, this.players[2].bid),
                team2Bid: Math.max(this.players[1].bid, this.players[3].bid)
            },
            overallStats: {
                roundsWon: [...this.roundsWon],
                totalRounds: this.currentRound,
                maxRounds: this.maxRounds
            }
        };

        // Clear the board and show round end screen
        this.io.to(this.gameCode).emit('roundEnded', roundEndData);

        // Check if game should end (team wins more than half of max rounds)
        const roundsToWin = Math.ceil(this.maxRounds / 2);
        if (this.roundsWon[0] >= roundsToWin || this.roundsWon[1] >= roundsToWin) {
            this.gamePhase = 'game_end';
            
            // Prepare game end data with comprehensive statistics
            const gameWinner = this.roundsWon[0] >= roundsToWin ? 0 : 1;
            const gameEndData = {
                gameWinner: gameWinner,
                gameWinnerTeam: gameWinner === 0 ? 'Team 1' : 'Team 2',
                gameWinnerPlayers: gameWinner === 0 ? 
                    `${this.players[0].name} & ${this.players[2].name}` : 
                    `${this.players[1].name} & ${this.players[3].name}`,
                finalScore: `${this.roundsWon[gameWinner]}-${this.roundsWon[1-gameWinner]}`,
                gameStats: {
                    totalRounds: this.currentRound,
                    roundsWon: [...this.roundsWon],
                    playerNames: this.players.map(p => p.name),
                    playerTotalTricks: this.playerStats.map(stat => stat.tricksWon),
                    roundScores: [...this.roundScores]
                }
            };

            // Show game end screen with statistics
            this.io.to(this.gameCode).emit('gameEnded', gameEndData);

        } else if (this.currentRound >= this.maxRounds) {
            this.gamePhase = 'game_end';
            
            // Determine winner by rounds won if max rounds reached
            let gameWinner = this.roundsWon[0] > this.roundsWon[1] ? 0 : 1;
            const gameEndData = {
                gameWinner: this.roundsWon[0] === this.roundsWon[1] ? -1 : gameWinner, // -1 for tie
                gameWinnerTeam: this.roundsWon[0] === this.roundsWon[1] ? 'Tie' : (gameWinner === 0 ? 'Team 1' : 'Team 2'),
                gameWinnerPlayers: this.roundsWon[0] === this.roundsWon[1] ? 'It\'s a tie!' : 
                    (gameWinner === 0 ? 
                        `${this.players[0].name} & ${this.players[2].name}` : 
                        `${this.players[1].name} & ${this.players[3].name}`),
                finalScore: `${this.roundsWon[0]}-${this.roundsWon[1]}`,
                gameStats: {
                    totalRounds: this.currentRound,
                    roundsWon: [...this.roundsWon],
                    playerNames: this.players.map(p => p.name),
                    playerTotalTricks: this.playerStats.map(stat => stat.tricksWon),
                    roundScores: [...this.roundScores]
                }
            };

            // Show game end screen with statistics
            this.io.to(this.gameCode).emit('gameEnded', gameEndData);

        } else {
            // Continue to next round
            this.currentRound++;
            this.gamePhase = 'round_end';
            
            // Reset round data
            this.tricksWon = [0, 0];
            this.currentTrick = [];
            this.trickWinner = null;
            this.trump = null;
            this.bids = [];
            this.bidWinningTeam = null;
            this.bidWinningPlayer = null;

            // Set next dealer (rotate dealer each round)
            const nextDealer = (this.currentRound - 1) % 4;
            this.currentPlayer = nextDealer;

            // Announce next round with countdown
            this.io.to(this.gameCode).emit('chatMessage', {
                message: `🔄 Round ${this.currentRound} starting in 5 seconds...`,
                sender: 'Game',
                timestamp: Date.now()
            });

            // Start countdown timer
            this.io.to(this.gameCode).emit('roundCountdown', { seconds: 10, nextRound: this.currentRound });

            // Start next round after countdown
            setTimeout(() => {
                this.startNewRound();
            }, 10000);
        }
        
        // Broadcast updated game state
        this.io.to(this.gameCode).emit('gameState', this.getGameState());
    }

    startNewRound() {
        this.gamePhase = 'dealing';
        this.dealCards();
        
        // Broadcast that dealing has started
        this.io.to(this.gameCode).emit('chatMessage', {
            message: `🃏 Round ${this.currentRound} - Dealing cards...`,
            sender: 'Game',
            timestamp: Date.now()
        });

        // Start bidding phase after dealing
        setTimeout(() => {
            this.startBiddingPhase();
        }, 3000);
    }

    getGameState() {
        return {
            gameCode: this.gameCode,
            players: this.players.map(p => ({ id: p.id, name: p.name, bid: p.bid })),
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            gamePhase: this.gamePhase,
            currentPlayer: this.currentPlayer,
            trump: this.trump,
            bidWinningTeam: this.bidWinningTeam,
            bidWinningPlayer: this.bidWinningPlayer,
            tricksWon: this.tricksWon,
            roundsWon: this.roundsWon,
            currentTrick: this.currentTrick,
            trickWinner: this.trickWinner,
            roundScores: this.roundScores,
            hostId: this.hostId,
            isPaused: this.isPaused
        };
    }

    startTimer(callback) {
        this.clearTimer();
        this.timer = setTimeout(callback, this.timerDuration);
    }

    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    autoAdvanceBid() {
        if (this.gamePhase === 'bidding') {
            // Auto-bid minimum for current player
            const currentPlayerId = this.players[this.currentPlayer].id;
            this.placeBid(currentPlayerId, MIN_BID);
            return true;
        }
        return false;
    }

    autoSelectTrump() {
        if (this.gamePhase === 'trump_selection') {
            // Auto-select first available suit
            const currentPlayerId = this.players[this.bidWinningPlayer].id;
            this.selectTrump(currentPlayerId, 'spades');
            return true;
        }
        return false;
    }

    autoPlayCard() {
        if (this.gamePhase === 'playing') {
            // Auto-play first valid card
            const currentPlayerId = this.players[this.currentPlayer].id;
            const validCards = this.getValidCards(currentPlayerId);
            if (validCards.length > 0) {
                this.playCard(currentPlayerId, validCards[0]);
                return true;
            }
        }
        return false;
    }

    getPlayerHand(playerId) {
        const player = this.players.find(p => p.id === playerId);
        return player ? player.hand : [];
    }

    nextRound() {
        if (this.gamePhase === 'round_end') {
            this.dealNewRound();
            return true;
        }
        return false;
    }
}

// Helper function to broadcast game state with valid cards
function broadcastGameState(game, gameCode) {
    // Send game state to all players
    io.to(gameCode).emit('game_state', game.getGameState());
    
    // Send valid cards to each player individually
    game.players.forEach(player => {
        const validCards = game.getValidCards(player.id);
        io.to(player.id).emit('valid_cards', validCards);
    });
}

// Timer utility functions
function startBiddingTimer(game, gameCode) {
    if (game.gamePhase === 'bidding') {
        // Emit timer start to all clients
        io.to(gameCode).emit('timer_start', { duration: 30000, type: 'bid' });
        
        game.startTimer(() => {
            if (game.autoAdvanceBid()) {
                io.to(gameCode).emit('game_state', game.getGameState());
                // Continue timer for next player if still bidding
                if (game.gamePhase === 'bidding') {
                    startBiddingTimer(game, gameCode);
                } else if (game.gamePhase === 'trump_selection') {
                    startTrumpTimer(game, gameCode);
                }
            }
        });
    }
}

function startTrumpTimer(game, gameCode) {
    if (game.gamePhase === 'trump_selection') {
        io.to(gameCode).emit('timer_start', { duration: 30000, type: 'game' });
        
        game.startTimer(() => {
            if (game.autoSelectTrump()) {
                io.to(gameCode).emit('game_state', game.getGameState());
            }
        });
    }
}

function startPlayTimer(game, gameCode) {
    if (game.gamePhase === 'playing') {
        io.to(gameCode).emit('timer_start', { duration: 30000, type: 'game' });
        
        game.startTimer(() => {
            if (game.autoPlayCard()) {
                broadcastGameState(game, gameCode);
                // Continue timer for next player
                if (game.gamePhase === 'playing') {
                    startPlayTimer(game, gameCode);
                }
            }
        });
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('host_game', (data) => {
        const gameCode = uuidv4().substr(0, 6).toUpperCase();
        const game = new Game(gameCode, data.maxRounds || 7, io);
        
        if (game.addPlayer(socket.id, data.playerName)) {
            games.set(gameCode, game);
            players.set(socket.id, { gameCode, playerIndex: 0 });
            socket.join(gameCode);
            
            socket.emit('game_hosted', { gameCode });
            io.to(gameCode).emit('game_state', game.getGameState());
        }
    });

    socket.on('join_game', (data) => {
        const game = games.get(data.gameCode);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        if (game.addPlayer(socket.id, data.playerName)) {
            const playerIndex = game.players.length - 1;
            players.set(socket.id, { gameCode: data.gameCode, playerIndex });
            socket.join(data.gameCode);
            
            socket.emit('game_joined', { gameCode: data.gameCode });
            io.to(data.gameCode).emit('game_state', game.getGameState());
            
            // If game just started (dealing phase), start card dealing animation
            if (game.gamePhase === 'dealing') {
                game.startCardDealing(data.gameCode);
            } else {
                // Send individual hands to each player for games in progress
                game.players.forEach((player, index) => {
                    io.to(player.id).emit('hand_update', game.getPlayerHand(player.id));
                });
            }

            // Start bidding timer when game begins
            if (game.gamePhase === 'bidding') {
                startBiddingTimer(game, data.gameCode);
            }
        } else {
            socket.emit('error', { message: 'Game is full' });
        }
    });

    socket.on('place_bid', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        if (game.placeBid(socket.id, data.bidAmount)) {
            io.to(playerData.gameCode).emit('game_state', game.getGameState());
            
            // Start timer for next player if still in bidding phase
            if (game.gamePhase === 'bidding') {
                startBiddingTimer(game, playerData.gameCode);
            } else if (game.gamePhase === 'trump_selection') {
                startTrumpTimer(game, playerData.gameCode);
            }
        }
    });

    socket.on('select_trump', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        if (game.selectTrump(socket.id, data.trumpSuit)) {
            broadcastGameState(game, playerData.gameCode);
            
            // Start play timer
            startPlayTimer(game, playerData.gameCode);
        }
    });

    socket.on('play_card', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        if (game.playCard(socket.id, data.card)) {
            const trickJustCompleted = game.currentTrick.length === 4;
            
            broadcastGameState(game, playerData.gameCode);
            
            // Start timer for next player if game is still in playing phase
            if (game.gamePhase === 'playing') {
                startPlayTimer(game, playerData.gameCode);
            }
            
            // Handle trick completion - broadcast state after trick is cleared
            if (trickJustCompleted && game.gamePhase === 'playing') {
                setTimeout(() => {
                    broadcastGameState(game, playerData.gameCode);
                    if (game.gamePhase === 'playing') {
                        startPlayTimer(game, playerData.gameCode);
                    }
                }, 2500); // 2.5 second delay - after trick clearing
            }
        }
    });

    socket.on('next_round', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        if (game.nextRound()) {
            // Start card dealing animation instead of immediately sending hands
            game.startCardDealing(playerData.gameCode);
        }
    });

    socket.on('chat_message', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        // Find the player name
        const player = game.players.find(p => p.id === socket.id);
        if (!player) return;

        // Broadcast the chat message to all players in the game
        io.to(playerData.gameCode).emit('chat_message', {
            playerName: player.name,
            message: data.message,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('pause_game', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        if (game.pauseGame(socket.id)) {
            broadcastGameState(game, playerData.gameCode);
        } else {
            socket.emit('error', { message: 'Only the host can pause the game' });
        }
    });

    socket.on('stop_game', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameCode);
        if (!game) return;

        if (game.stopGame(socket.id)) {
            // Game stopped, return players to start screen after 3 seconds
            setTimeout(() => {
                io.to(playerData.gameCode).emit('gameEnded');
            }, 3000);
        } else {
            socket.emit('error', { message: 'Only the host can stop the game' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.gameCode);
            if (game) {
                // Clean up timer
                game.clearTimer();
                
                // Notify other players
                socket.to(playerData.gameCode).emit('player_disconnected', {
                    playerId: socket.id
                });
            }
            players.delete(socket.id);
        }
    });

    socket.on('error', (error) => {
        console.log('Socket error:', error);
    });
});

// Add error handling for the server
server.on('error', (error) => {
    console.error('Server error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
