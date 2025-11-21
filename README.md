# 🎥 AuraMeet - Video Conferencing with Virtual Whiteboard

A real-time video conferencing application built with WebRTC, featuring an interactive virtual whiteboard with hand gesture recognition powered by MediaPipe.

## 🌐 Live Demo

**Check it out here:** [https://aurameet.onrender.com/](https://aurameet.onrender.com/)

> **Note:** The app is hosted on Render's free tier, so it may take ~30 seconds to wake up if it hasn't been used recently. Please be patient! ☕

---

## 🌟 About This Project

Yeah, I know it sounds like Google Meet or Zoom, but I wanted to build one myself! 🚀 I wanted to understand how video conferencing actually works under the hood and add some cool features that I thought would be fun. It's still a work in progress and needs many improvements, but hey, I gave it my best shot and learned a ton along the way!

---

## ✨ Features

### Core Video Conferencing
- 📹 **Real-time Video/Audio Communication** - Built with WebRTC for peer-to-peer connections
- 🔇 **Mute/Unmute Audio** - Toggle your microphone with a button or keyboard shortcut (Ctrl+D)
- 📷 **Start/Stop Video** - Control your camera feed (Ctrl+E)
- 🖥️ **Screen Sharing** - Share your screen with other participants (Ctrl+Shift+S)
- 👥 **Multiple Participants** - Support for multiple users in the same room
- ⏱️ **Meeting Timer** - Track meeting duration automatically
- 🔗 **Easy Room Sharing** - Copy meeting link to invite others
- 📽️ **Fullscreen Mode** - Immersive meeting experience
- 🎬 **Local Recording** - Record your meetings locally

### Virtual Whiteboard 🎨
The coolest part! A collaborative whiteboard with gesture control:

#### Hand Gesture Recognition
- ☝️ **Index Finger** - Draw on the whiteboard
- ✌️ **Two Fingers** - Erase mode
- ✋ **Open Palm** - Clear the entire board

#### Drawing Features
- 🎨 **8 Color Options** - Red, Green, Blue, Yellow, Orange, Purple, Black, White
- 📏 **3 Brush Sizes** - Small, Medium, Large
- 🖱️ **Mouse/Touch Support** - Draw with mouse or touch as fallback
- 💾 **Save Drawing** - Export your whiteboard as PNG
- 🗑️ **Clear Board** - Start fresh anytime
- 🔄 **Real-time Sync** - All participants see the same whiteboard

### UI/UX Features
- 🎨 **Modern Dark UI** - Easy on the eyes
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🔔 **Notifications** - Visual feedback for all actions
- 💡 **Tooltips** - Helpful hints on hover
- ⌨️ **Keyboard Shortcuts** - Quick access to common features
- 🎯 **Connection Status Indicator** - Know your connection state

---

## 🛠️ Tech Stack

**Frontend:**
- Vanilla JavaScript (no framework, keeping it simple!)
- HTML5 Canvas for whiteboard
- CSS3 for styling
- MediaPipe for hand gesture recognition

**Backend:**
- Node.js
- Express.js
- Socket.io for real-time communication

**WebRTC:**
- RTCPeerConnection for peer-to-peer video/audio
- STUN servers for NAT traversal

---

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/aurameet.git
   cd aurameet
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

---

## 🎮 How to Use

### Starting a Meeting
1. Visit [https://aurameet.onrender.com/](https://aurameet.onrender.com/) or `http://localhost:3000`
2. You'll be automatically redirected to a new room
3. Share the URL with others to invite them

### Using the Whiteboard
1. Click the **whiteboard button** (pencil icon) in the control bar
2. Use hand gestures in front of your camera:
   - Point with index finger to draw
   - Use two fingers to erase
   - Show open palm to clear board
3. Or use your mouse/touch to draw directly
4. Choose colors and brush sizes from the toolbar
5. Save your drawing or clear the board using toolbar buttons

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl + D` | Mute/Unmute |
| `Ctrl + E` | Start/Stop Video |
| `Ctrl + Shift + S` | Share Screen |

---

## 🏗️ Project Structure

```
aurameet/
├── public/
│   ├── index.html          # Main HTML file
│   └── script.js           # Client-side JavaScript
├── server.js               # Express & Socket.io server
├── package.json            # Dependencies
└── README.md               # You are here!
```

---

## 🔮 Future Improvements

This project still needs a lot of work! Here are some ideas:

- [ ] Chat functionality
- [ ] Virtual backgrounds
- [ ] Reactions/emojis
- [ ] Better mobile experience
- [ ] Recording improvements (cloud storage)
- [ ] Waiting room feature
- [ ] Host controls (mute all, etc.)
- [ ] Better UI for large meetings
- [ ] Whiteboard layers
- [ ] More drawing tools (shapes, text, etc.)
- [ ] TURN server for better connectivity
- [ ] Authentication system
- [ ] Meeting scheduling
- [ ] Better error handling
- [ ] Performance optimizations

---

## 🐛 Known Issues

- Screen sharing preview sometimes doesn't clear properly
- Hand gesture recognition can be sensitive to lighting
- Large meetings (5+ people) might need optimization
- No mobile browser support for screen sharing
- Recording only saves local video, not the entire meeting

---

## 🤝 Contributing

Feel free to fork this project and make it better! I'm still learning, so any suggestions or improvements are welcome.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

MIT License - feel free to use this project however you want!

---

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for the awesome hand tracking
- [Socket.io](https://socket.io/) for making real-time communication easy
- [WebRTC](https://webrtc.org/) for the magic of peer-to-peer connections
- The countless Stack Overflow answers that helped me debug 😅

---

## 📞 Contact

If you have any questions or suggestions, feel free to open an issue!

---

*Built with 💻 and ☕ by someone who wanted to understand how video calls actually work!*

Remember: This is a learning project, not a production-ready application. Use it for fun, learning, and experimentation!
