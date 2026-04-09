const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'scores.json');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// In-memory scores DB
let userScores = {};
let totalClicks = 0;

// Load initial scores if file exists to persist across server restarts
if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    userScores = data.userScores || {};
    totalClicks = data.totalClicks || 0;
  } catch (e) {
    console.error("Failed to parse scores.json", e);
  }
}

// Function to save scores to file periodically (every 5 seconds)
setInterval(() => {
  fs.writeFileSync(DB_FILE, JSON.stringify({ userScores, totalClicks }));
}, 5000);

// Function to broadcast rankings
setInterval(() => {
  // Convert object to sorted array
  const ranking = Object.keys(userScores).map(id => {
    return { id, score: userScores[id] };
  }).sort((a, b) => b.score - a.score);

  io.emit('leaderboard_update', {
    totalClicks,
    ranking
  });
}, 1000); // Broadcast every 1 second to all connected clients

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send immediate state upon connection so they don't wait 1s empty
  const ranking = Object.keys(userScores).map(id => {
    return { id, score: userScores[id] };
  }).sort((a, b) => b.score - a.score);
  socket.emit('leaderboard_update', { totalClicks, ranking });

  // Handle batched clicks from clients
  socket.on('add_clicks', (data) => {
    const { id, count } = data;
    if (!id || typeof count !== 'number' || count <= 0) return;
    
    // Prevent cheating by capping clicks per payload
    const validCount = Math.min(count, 100); 

    if (!userScores[id]) {
      userScores[id] = 0;
    }
    
    userScores[id] += validCount;
    totalClicks += validCount;
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Please go to http://localhost:${PORT}`);
});
