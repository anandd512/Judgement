console.log('Starting minimal server...');

try {
    const express = require('express');
    console.log('Express loaded');
    
    const http = require('http');
    console.log('HTTP loaded');
    
    const socketIo = require('socket.io');
    console.log('Socket.IO loaded');
    
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);
    
    console.log('Server setup complete');
    
    const PORT = 3000;
    server.listen(PORT, () => {
        console.log(`Minimal server running on port ${PORT}`);
    });
    
} catch (error) {
    console.error('Error:', error);
}
