// public/script.js - Enhanced with Virtual Whiteboard

const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('local-video');

let localStream;
let peerConnections = {};
let screenSenders = {};
let userVideoTracks = {};

let isScreenSharing = false;
let screenStream = null;
let localScreenPreviewContainer = null;

// Whiteboard variables
let isWhiteboardActive = false;
let whiteboardCanvas, whiteboardCtx;
let gestureCanvas, gestureCtx;
let currentColor = '#ea4335';
let currentSize = 5;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let hands;
let camera;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- 1. Get Room ID and User Media ---

const roomId = window.location.pathname.split('/')[2] || 'default-room';

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    socket.emit('join-room', roomId);
    showNotification(`Joined room: ${roomId}`, 'success');
    initializeWhiteboard();
}).catch(error => {
    console.error("Error accessing media devices.", error);
    alert("Could not access camera or mic. Please check permissions.");
});

// --- 2. Socket.io Signaling Logic ---

socket.on('user-joined', (socketId) => {
    console.log('A new user joined:', socketId);
    showNotification('A user joined the meeting', 'info');
    const pc = createPeerConnection(socketId);
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    createAndSendOffer(pc, socketId);
    updateParticipantCount();
});

socket.on('offer', (payload) => {
    console.log('Received an offer from:', payload.caller);
    let pc = peerConnections[payload.caller];
    if (!pc) {
        pc = createPeerConnection(payload.caller);
    }

    localStream.getTracks().forEach(track => {
        if (!pc.getSenders().find(s => s.track === track)) {
            pc.addTrack(track, localStream);
        }
    });
    
    pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            const payloadAnswer = {
                target: payload.caller,
                caller: socket.id,
                answer: pc.localDescription
            };
            socket.emit('answer', payloadAnswer);
        })
        .catch(e => console.error(e));
});

socket.on('answer', (payload) => {
    console.log('Received an answer from:', payload.caller);
    const pc = peerConnections[payload.caller];
    if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
    }
});

socket.on('ice-candidate', (payload) => {
    const pc = peerConnections[payload.caller];
    if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
});

socket.on('peer-mute-status', (data) => {
    console.log('Peer mute status changed:', data);
    const videoContainer = document.getElementById('container-' + data.socketId + '-cam');
    if (videoContainer) {
        const remoteMuteIndicator = videoContainer.querySelector('.mute-indicator');
        if (remoteMuteIndicator) {
            remoteMuteIndicator.style.display = data.muted ? 'block' : 'none';
        }
    }
});

socket.on('user-left', (socketId) => {
    console.log('User left:', socketId);
    showNotification('A user left the meeting', 'info');
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
    }
    if (userVideoTracks[socketId]) {
        Object.values(userVideoTracks[socketId]).forEach(videoContainer => {
            if (videoContainer) videoContainer.remove();
        });
        delete userVideoTracks[socketId];
    }
    updateParticipantCount();
});

// Whiteboard sync
socket.on('whiteboard-draw', (data) => {
    drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.size);
});

socket.on('whiteboard-clear', () => {
    clearWhiteboard();
});

// --- 3. WebRTC Helper Functions ---

function createPeerConnection(socketId) {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[socketId] = pc;
    
    if (!userVideoTracks[socketId]) {
        userVideoTracks[socketId] = {};
    }

    pc.ontrack = (event) => {
        const track = event.track;
        if (track.kind !== 'video') return;
        if (userVideoTracks[socketId][track.id]) return;

        const isScreen = Object.keys(userVideoTracks[socketId]).length > 0;
        const uniqueId = isScreen ? 'screen' : 'cam';
        const containerId = `container-${socketId}-${uniqueId}`;

        const videoContainer = document.createElement('div');
        videoContainer.id = containerId;
        videoContainer.className = 'video-container';
        
        const remoteVideo = document.createElement('video');
        remoteVideo.id = `video-${socketId}-${uniqueId}`;
        remoteVideo.className = 'remote-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.srcObject = new MediaStream([track]);

        videoContainer.appendChild(remoteVideo);

        if (!isScreen) {
            const muteIndicator = document.createElement('div');
            muteIndicator.id = `mute-${socketId}`;
            muteIndicator.className = 'mute-indicator';
            muteIndicator.textContent = 'MUTED';
            muteIndicator.style.display = 'none';
            videoContainer.appendChild(muteIndicator);
        } else {
            videoContainer.classList.add('screen-share');
            const label = document.createElement('div');
            label.className = 'sharer-label';
            label.textContent = `User ${socketId.substring(0, 4)} is sharing`;
            videoContainer.appendChild(label);
            showNotification('Screen sharing started', 'info');
        }
        
        videoGrid.appendChild(videoContainer);
        userVideoTracks[socketId][track.id] = videoContainer;

        track.onended = () => {
            console.log('Track ended:', track.id);
            if (userVideoTracks[socketId] && userVideoTracks[socketId][track.id]) {
                const container = userVideoTracks[socketId][track.id];
                if (container) {
                    container.remove();
                }
                delete userVideoTracks[socketId][track.id];
                if (isScreen) {
                    showNotification('Screen sharing stopped', 'info');
                }
            }
        };
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const payload = {
                target: socketId,
                caller: socket.id,
                candidate: event.candidate
            };
            socket.emit('ice-candidate', payload);
        }
    };

    pc.onconnectionstatechange = () => {
        console.log(`Connection state: ${pc.connectionState}`);
    };

    return pc;
}

function createAndSendOffer(pc, targetSocketId) {
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
            const payload = {
                target: targetSocketId,
                caller: socket.id,
                offer: pc.localDescription
            };
            socket.emit('offer', payload);
        })
        .catch(e => console.error(e));
}

// --- 4. Control Button Logic ---

const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const screenShareBtn = document.getElementById('screen-share-btn');
const whiteboardBtn = document.getElementById('whiteboard-btn');
const localMuteIndicator = document.getElementById('local-mute-indicator');
const copyLinkBtn = document.getElementById('copy-link-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const settingsBtn = document.getElementById('settings-btn');
const leaveBtn = document.getElementById('leave-btn');
const recordBtn = document.getElementById('record-btn');

let isAudioMuted = false;
let isVideoStopped = false;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

muteBtn.addEventListener('click', () => {
    if (localStream && localStream.getAudioTracks().length > 0) {
        isAudioMuted = !isAudioMuted;
        localStream.getAudioTracks()[0].enabled = !isAudioMuted;
        muteBtn.innerHTML = isAudioMuted ? 
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>' : 
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>';
        muteBtn.classList.toggle('toggled', isAudioMuted);
        localMuteIndicator.style.display = isAudioMuted ? 'block' : 'none';
        socket.emit('mute-status-changed', { muted: isAudioMuted });
        showNotification(isAudioMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
    }
});

videoBtn.addEventListener('click', () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
        isVideoStopped = !isVideoStopped;
        localStream.getVideoTracks()[0].enabled = !isVideoStopped;
        videoBtn.innerHTML = isVideoStopped ? 
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>' : 
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
        videoBtn.classList.toggle('toggled', isVideoStopped);
        showNotification(isVideoStopped ? 'Camera stopped' : 'Camera started', 'info');
    }
});

// --- 5. Screen Sharing Functions ---

screenShareBtn.addEventListener('click', () => {
    if (isScreenSharing) {
        stopScreenShare();
    } else {
        startScreenShare();
    }
});

async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { cursor: "always" },
            audio: false 
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        const videoContainer = document.createElement('div');
        videoContainer.id = 'local-screen-preview';
        videoContainer.className = 'video-container screen-share';
        
        const remoteVideo = document.createElement('video');
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.muted = true;
        remoteVideo.srcObject = new MediaStream([screenTrack]);

        const label = document.createElement('div');
        label.className = 'sharer-label';
        label.textContent = 'You are sharing your screen';
        
        videoContainer.appendChild(remoteVideo);
        videoContainer.appendChild(label);
        videoGrid.appendChild(videoContainer);
        localScreenPreviewContainer = videoContainer;

        for (const socketId in peerConnections) {
            const pc = peerConnections[socketId];
            const sender = pc.addTrack(screenTrack, screenStream);
            screenSenders[socketId] = sender;
            createAndSendOffer(pc, socketId);
        }

        isScreenSharing = true;
        screenShareBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/></svg>';
        screenShareBtn.classList.add('toggled');
        showNotification('Screen sharing started', 'success');

        screenTrack.onended = () => {
            if (isScreenSharing) {
                stopScreenShare();
            }
        };
    } catch (err) {
        console.error("Error starting screen share:", err);
        showNotification('Could not start screen sharing', 'error');
    }
}

async function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Remove local screen preview immediately
    if (localScreenPreviewContainer) {
        localScreenPreviewContainer.remove();
        localScreenPreviewContainer = null;
    }

    for (const socketId in peerConnections) {
        const pc = peerConnections[socketId];
        const sender = screenSenders[socketId];
        
        if (sender) {
            pc.removeTrack(sender);
            delete screenSenders[socketId];
            createAndSendOffer(pc, socketId);
        }
    }

    isScreenSharing = false;
    screenShareBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 16V6h16v10H4z"/></svg>';
    screenShareBtn.classList.remove('toggled');
    showNotification('Screen sharing stopped', 'info');
}

// --- 6. WHITEBOARD FUNCTIONALITY ---

function initializeWhiteboard() {
    whiteboardCanvas = document.getElementById('whiteboard-canvas');
    gestureCanvas = document.getElementById('gesture-canvas');
    whiteboardCtx = whiteboardCanvas.getContext('2d');
    gestureCtx = gestureCanvas.getContext('2d');
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColor = btn.dataset.color;
        });
    });
    
    // Size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSize = parseInt(btn.dataset.size);
        });
    });
    
    // Clear button
    document.getElementById('clear-board-btn').addEventListener('click', () => {
        clearWhiteboard();
        socket.emit('whiteboard-clear', roomId);
        showNotification('Board cleared', 'info');
    });
    
    // Save button
    document.getElementById('save-board-btn').addEventListener('click', saveWhiteboard);
    
    // Mouse/Touch drawing
    whiteboardCanvas.addEventListener('mousedown', startDrawingMouse);
    whiteboardCanvas.addEventListener('mousemove', drawMouse);
    whiteboardCanvas.addEventListener('mouseup', stopDrawingMouse);
    whiteboardCanvas.addEventListener('mouseout', stopDrawingMouse);
    
    whiteboardCanvas.addEventListener('touchstart', startDrawingTouch);
    whiteboardCanvas.addEventListener('touchmove', drawTouch);
    whiteboardCanvas.addEventListener('touchend', stopDrawingMouse);
}

function resizeCanvas() {
    if (whiteboardCanvas && gestureCanvas) {
        whiteboardCanvas.width = window.innerWidth;
        whiteboardCanvas.height = window.innerHeight;
        gestureCanvas.width = window.innerWidth;
        gestureCanvas.height = window.innerHeight;
    }
}

whiteboardBtn.addEventListener('click', () => {
    if (!isWhiteboardActive) {
        startWhiteboard();
    } else {
        stopWhiteboard();
    }
});

async function startWhiteboard() {
    isWhiteboardActive = true;
    document.getElementById('whiteboard-container').classList.add('active');
    document.getElementById('whiteboard-toolbar').classList.add('active');
    document.querySelector('.gesture-indicator').classList.add('active');
    whiteboardBtn.classList.add('active');
    
    showNotification('Whiteboard activated! Use gestures or mouse to draw', 'success');
    
    // Initialize MediaPipe Hands
    if (typeof Hands !== 'undefined') {
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });
        
        hands.onResults(onHandResults);
        
        // Use the camera
        if (localStream && typeof Camera !== 'undefined') {
            camera = new Camera(localVideo, {
                onFrame: async () => {
                    if (isWhiteboardActive && hands) {
                        await hands.send({image: localVideo});
                    }
                },
                width: 640,
                height: 480
            });
            camera.start();
        }
    } else {
        showNotification('Hand tracking not available. Use mouse to draw.', 'info');
    }
}

function stopWhiteboard() {
    isWhiteboardActive = false;
    document.getElementById('whiteboard-container').classList.remove('active');
    document.getElementById('whiteboard-toolbar').classList.remove('active');
    document.querySelector('.gesture-indicator').classList.remove('active');
    whiteboardBtn.classList.remove('active');
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    showNotification('Whiteboard deactivated', 'info');
}

function onHandResults(results) {
    if (!isWhiteboardActive) return;
    
    // Clear gesture canvas
    gestureCtx.save();
    gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Draw hand skeleton if drawConnectors is available
        if (typeof drawConnectors !== 'undefined' && typeof HAND_CONNECTIONS !== 'undefined') {
            drawConnectors(gestureCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        }
        if (typeof drawLandmarks !== 'undefined') {
            drawLandmarks(gestureCtx, landmarks, {color: '#FF0000', lineWidth: 1});
        }
        
        // Detect gestures
        const gesture = detectGesture(landmarks);
        updateGestureIndicator(gesture);
        
        // Get index finger tip position
        const indexTip = landmarks[8];
        const x = indexTip.x * gestureCanvas.width;
        const y = indexTip.y * gestureCanvas.height;
        
        if (gesture === 'index') {
            // Drawing mode
            if (!isDrawing) {
                isDrawing = true;
                lastX = x;
                lastY = y;
            } else {
                drawLine(lastX, lastY, x, y, currentColor, currentSize);
                socket.emit('whiteboard-draw', {
                    roomId,
                    x1: lastX,
                    y1: lastY,
                    x2: x,
                    y2: y,
                    color: currentColor,
                    size: currentSize
                });
                lastX = x;
                lastY = y;
            }
        } else if (gesture === 'two-fingers') {
            // Erase mode
            if (!isDrawing) {
                isDrawing = true;
                lastX = x;
                lastY = y;
            } else {
                drawLine(lastX, lastY, x, y, '#000000', currentSize * 3);
                socket.emit('whiteboard-draw', {
                    roomId,
                    x1: lastX,
                    y1: lastY,
                    x2: x,
                    y2: y,
                    color: '#000000',
                    size: currentSize * 3
                });
                lastX = x;
                lastY = y;
            }
        } else if (gesture === 'palm') {
            // Clear board with open palm
            if (isDrawing) {
                clearWhiteboard();
                socket.emit('whiteboard-clear', roomId);
                showNotification('Board cleared!', 'info');
                isDrawing = false;
            }
        } else {
            isDrawing = false;
        }
    }
    
    gestureCtx.restore();
}

function detectGesture(landmarks) {
    // Finger states
    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;
    const ringUp = landmarks[16].y < landmarks[14].y;
    const pinkyUp = landmarks[20].y < landmarks[18].y;
    const thumbOut = Math.abs(landmarks[4].x - landmarks[3].x) > 0.05;
    
    // Index finger only pointing (draw)
    if (indexUp && !middleUp && !ringUp && !pinkyUp) {
        return 'index';
    } 
    // Two fingers up (erase)
    else if (indexUp && middleUp && !ringUp && !pinkyUp) {
        return 'two-fingers';
    } 
    // Open palm (all fingers up - clear board)
    else if (indexUp && middleUp && ringUp && pinkyUp && thumbOut) {
        return 'palm';
    }
    
    return 'none';
}

function updateGestureIndicator(gesture) {
    const icon = document.getElementById('gesture-icon');
    const text = document.getElementById('gesture-text');
    
    switch(gesture) {
        case 'index':
            icon.textContent = '☝️';
            text.textContent = 'Drawing...';
            break;
        case 'two-fingers':
            icon.textContent = '✌️';
            text.textContent = 'Erasing...';
            break;
        case 'palm':
            icon.textContent = '✋';
            text.textContent = 'Clear board';
            break;
        default:
            icon.textContent = '✋';
            text.textContent = 'Ready to draw';
    }
}

function drawLine(x1, y1, x2, y2, color, size) {
    whiteboardCtx.beginPath();
    whiteboardCtx.strokeStyle = color;
    whiteboardCtx.lineWidth = size;
    whiteboardCtx.lineCap = 'round';
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.moveTo(x1, y1);
    whiteboardCtx.lineTo(x2, y2);
    whiteboardCtx.stroke();
}

function clearWhiteboard() {
    whiteboardCtx.fillStyle = '#000000';
    whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
}

function saveWhiteboard() {
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = whiteboardCanvas.toDataURL();
    link.click();
    showNotification('Whiteboard saved!', 'success');
}

// Mouse/Touch drawing fallback
function startDrawingMouse(e) {
    if (!isWhiteboardActive) return;
    isDrawing = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
}

function drawMouse(e) {
    if (!isDrawing || !isWhiteboardActive) return;
    const x = e.offsetX;
    const y = e.offsetY;
    drawLine(lastX, lastY, x, y, currentColor, currentSize);
    socket.emit('whiteboard-draw', {
        roomId,
        x1: lastX,
        y1: lastY,
        x2: x,
        y2: y,
        color: currentColor,
        size: currentSize
    });
    lastX = x;
    lastY = y;
}

function stopDrawingMouse() {
    isDrawing = false;
}

function startDrawingTouch(e) {
    if (!isWhiteboardActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = whiteboardCanvas.getBoundingClientRect();
    isDrawing = true;
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
}

function drawTouch(e) {
    if (!isDrawing || !isWhiteboardActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = whiteboardCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    drawLine(lastX, lastY, x, y, currentColor, currentSize);
    socket.emit('whiteboard-draw', {
        roomId,
        x1: lastX,
        y1: lastY,
        x2: x,
        y2: y,
        color: currentColor,
        size: currentSize
    });
    lastX = x;
    lastY = y;
}

// --- 7. Additional Features ---

copyLinkBtn.addEventListener('click', () => {
    const meetingLink = window.location.href;
    navigator.clipboard.writeText(meetingLink).then(() => {
        showNotification('Meeting link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy link:', err);
        showNotification('Failed to copy link', 'error');
    });
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
        showNotification('Entered fullscreen', 'info');
    } else {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
        showNotification('Exited fullscreen', 'info');
    }
});

settingsBtn.addEventListener('click', () => {
    showNotification('Settings panel coming soon!', 'info');
});

leaveBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the meeting?')) {
        window.location.href = '/';
    }
});

// Recording functionality
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

function startRecording() {
    try {
        mediaRecorder = new MediaRecorder(localStream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meeting-recording-${Date.now()}.webm`;
            a.click();
            showNotification('Recording saved!', 'success');
        };
        
        mediaRecorder.start();
        isRecording = true;
        recordBtn.classList.add('recording');
        showNotification('Recording started', 'success');
    } catch (err) {
        console.error('Error starting recording:', err);
        showNotification('Could not start recording', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
        showNotification('Recording stopped', 'info');
    }
}

// --- 8. Utility Functions ---

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function updateParticipantCount() {
    const count = Object.keys(peerConnections).length + 1;
    document.getElementById('participant-count').textContent = count;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        muteBtn.click();
    } else if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        videoBtn.click();
    } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        screenShareBtn.click();
    }
});