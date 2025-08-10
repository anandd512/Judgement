# Judgement Card Game

A 4-player trick-based card game built with Node.js, Express, Socket.IO, HTML, CSS, and JavaScript.

## Game Overview

Judgement is a strategic card game where 4 players form 2 teams:
- **Team 1**: Player 1 & Player 3
- **Team 2**: Player 2 & Player 4

The game consists of multiple rounds (configurable 5-11 rounds) where teams bid on tricks and try to achieve their bid to win rounds.

## Features

- Real-time multiplayer gameplay using Socket.IO
- **Mobile-responsive design** optimized for phones and tablets
- **Touch-friendly interface** with haptic feedback
- Card game logic with bidding, trump selection, and trick-taking
- Team-based scoring system
- Game rooms with unique codes
- Visual card representations using SVG assets
- **Landscape orientation support** for better mobile experience
- **Connection status indicator** with auto-reconnection
- **Optimized card interactions** for touchscreen devices

## Mobile Experience

The game is fully optimized for mobile devices:

### Features:
- **Responsive Layout**: Adapts to all screen sizes
- **Touch Controls**: Large, touch-friendly buttons and cards
- **Haptic Feedback**: Vibration feedback on supported devices
- **Optimized Card Size**: Cards automatically resize for screen size
- **Landscape Mode**: Better experience in landscape orientation
- **Pull-to-Refresh Prevention**: Smooth gameplay without accidental refreshes
- **iOS Safari Compatible**: Works perfectly on iPhone/iPad
- **Android Compatible**: Optimized for all Android browsers

### Best Mobile Experience:
1. Use landscape orientation for optimal card visibility
2. Ensure stable WiFi connection for real-time gameplay
3. Use latest Chrome, Safari, or Edge browser
4. Enable haptic feedback in device settings

## Installation

1. Make sure you have Node.js installed on your system
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Game

1. Start the server:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. One player should "Host Game" and share the game code with 3 other players

4. Other players should "Join Game" using the shared game code

## Game Rules

### Setup
- 4 players required
- 13 cards dealt to each player from a standard 52-card deck
- Players form teams: (1,3) vs (2,4)

### Bidding Phase
- Each player bids how many tricks their team will win (6-13)
- Bidding order rotates each round
- Team with higher combined bid wins the bid
- Within winning team, player with higher bid (or last to bid if tied) selects trump

### Playing Phase
- Bid winner starts by playing a card
- Players must follow suit if possible
- Trump cards beat non-trump cards
- Highest card in leading suit wins if no trump played
- Trick winner leads next trick

### Scoring
- Team that won the bid must achieve at least their bid in tricks
- If they succeed, they win the round
- If they fail, the other team wins the round
- Team with most round wins after all rounds wins the game

## Project Structure

```
Judgement/
├── server/
│   └── app.js              # Main server file with game logic
├── public/
│   ├── index.html          # Main game interface
│   ├── css/
│   │   └── style.css       # Game styling
│   └── js/
│       └── app.js          # Client-side game logic
├── Assets/                 # Card SVG images
├── package.json            # Project dependencies
└── README.md              # This file
```

## Technologies Used

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Real-time Communication**: Socket.IO
- **Card Assets**: SVG images

## Game Flow

1. **Lobby**: Players join using game code
2. **Bidding**: Each player bids on tricks their team will win
3. **Trump Selection**: Winning bidder selects trump suit
4. **Card Play**: Players play cards in tricks
5. **Scoring**: Round winner determined by bid achievement
6. **Next Round**: Process repeats until all rounds complete
7. **Game End**: Team with most round wins is declared winner

## Testing on Mobile

### Local Network Testing:
1. Find your computer's IP address:
   ```bash
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```
2. Start the server: `npm start`
3. On your mobile device, navigate to: `http://YOUR_IP:3000`
4. Test multiplayer by opening multiple mobile browsers

### Mobile Browser Developer Tools:
1. Chrome: Menu → More Tools → Developer Tools → Device Toolbar
2. Firefox: Tools → Web Developer → Responsive Design Mode
3. Safari: Develop → Enter Responsive Design Mode

### Testing Checklist:
- [ ] Game loads quickly on mobile
- [ ] Touch controls are responsive
- [ ] Cards are easily selectable
- [ ] Text is readable without zooming
- [ ] Game works in both portrait and landscape
- [ ] Connection status indicator works
- [ ] Multiple players can join from mobile devices

## Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Submitting pull requests
- Improving documentation

## License

This project is licensed under the MIT License.
