# Judgement Card Game 🎮

A real-time multiplayer 4-player trick-based card game built with Node.js, Express, and Socket.IO.

## 🌐 Live Demo

**Play Online**: [https://judgement-card-game-webapp-dthfebcvhbbpb0bc.westus3-01.azurewebsites.net/](https://judgement-card-game-webapp-dthfebcvhbbpb0bc.westus3-01.azurewebsites.net/)

## 🎯 Features

- **Real-time multiplayer**: 4 players with live updates
- **Host controls**: Pause, stop, and manage games
- **Chat system**: In-game communication
- **Mobile responsive**: Works on all devices  
- **Game statistics**: Track scores and performance
- **Timer system**: Automated round management

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/anandd512/Judgement.git
   cd Judgement
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🎲 How to Play

### Game Setup
1. One player creates a game and shares the game code
2. Other players join using the game code
3. Host starts the game when all 4 players are ready

### Gameplay
1. **Bidding Phase**: Each player bids on how many tricks they'll win
2. **Playing Phase**: Play cards in turns, highest card wins the trick
3. **Scoring**: Points awarded based on bid accuracy
4. **Multiple Rounds**: Game continues through different hand sizes

### Winning
- Score points by meeting your exact bid
- Bonus points for perfect bids
- Player with highest total score wins

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Deployment**: Azure App Service (Linux)
- **CI/CD**: GitHub Actions

## 📁 Project Structure

```
Judgement/
├── server/
│   └── app.js              # Main server file
├── public/
│   ├── index.html          # Game interface
│   ├── css/style.css       # Styling
│   └── js/app.js          # Client-side logic
├── Assets/                 # Card images (SVG)
├── .github/workflows/      # GitHub Actions
└── package.json           # Dependencies
```

## 🚀 Deployment

The game is automatically deployed to Azure App Service using GitHub Actions. Any push to the `main` branch triggers a new deployment.

### Manual Deployment
If you want to deploy your own instance:

1. Create an Azure App Service (Linux, Node.js 20)
2. Fork this repository
3. Add your publish profile as a GitHub secret: `AZUREAPPSERVICE_PUBLISHPROFILE_JUDGEMENTCARDGAME`
4. Update the workflow file with your app name
5. Push to trigger deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🎮 Game Rules

**Judgement** is a trick-taking card game where players must bid exactly how many tricks they think they can win. The challenge is in accurate bidding and strategic play.

### Scoring
- **Exact bid**: 10 + (2 × bid) points
- **Wrong bid**: 0 points
- **Bonus**: Extra points for difficult bids

Enjoy playing Judgement! 🎉
