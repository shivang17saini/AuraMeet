// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Tell Express to serve our 'public' folder
app.use(express.static('public'));

// Serve the main HTML page for any room
app.get('/:room', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Home page redirect
app.get('/', (req, res) => {
    const roomId = Math.random().toString(36).substring(7);
    res.redirect(`/${roomId}`);
});

// --- Signaling and Whiteboard Logic ---

io.on('connection', (socket) => {
    console.log('A user connected with ID:', socket.id);

    // 1. User asks to join a room
    socket.on('join-room', (roomId) => {
        socket.join(roomId); // Put the user in the room
        console.log(`User ${socket.id} joined room ${roomId}`);

        // 2. Tell everyone else in the room that this new user joined
        socket.to(roomId).emit('user-joined', socket.id);

        // 3. Relay the "offer"
        socket.on('offer', (payload) => {
            io.to(payload.target).emit('offer', payload);
        });

        // 4. Relay the "answer"
        socket.on('answer', (payload) => {
            io.to(payload.target).emit('answer', payload);
        });

        // 5. Relay ICE candidates
        socket.on('ice-candidate', (payload) => {
            io.to(payload.target).emit('ice-candidate', payload);
        });

        // 6. Relay mute status
        socket.on('mute-status-changed', (data) => {
            socket.to(roomId).emit('peer-mute-status', { 
                socketId: socket.id, 
                muted: data.muted 
            });
        });

        // 7. Whiteboard drawing events
        socket.on('whiteboard-draw', (data) => {
            // Broadcast drawing to all other users in the room
            socket.to(data.roomId).emit('whiteboard-draw', {
                x1: data.x1,
                y1: data.y1,
                x2: data.x2,
                y2: data.y2,
                color: data.color,
                size: data.size
            });
        });

        // 8. Whiteboard clear event
        socket.on('whiteboard-clear', (roomId) => {
            // Broadcast clear to all other users in the room
            socket.to(roomId).emit('whiteboard-clear');
        });

        // Handle user leaving
        socket.on('disconnect', () => {
            console.log(`User ${socket.id} disconnected`);
            io.to(roomId).emit('user-left', socket.id);
        });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
