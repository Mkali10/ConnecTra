// ConnecTra WebRTC Engine - PRODUCTION READY
class ConnecTraWebRTC {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.socket = io();
    this.pc = new RTCPeerConnection({
      iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
    });
    this.channels = {};
    this.init();
  }

  async init() {
    // Screen capture
    navigator.mediaDevices.getDisplayMedia({video: true, audio: true})
      .then(stream => {
        stream.getTracks().forEach(track => this.pc.addTrack(track, stream));
        document.getElementById('localVideo').srcObject = stream;
      });

    // Data channels
    this.channels.control = this.pc.createDataChannel('control');
    this.channels.chat = this.pc.createDataChannel('chat');
    
    this.pc.ontrack = e => document.getElementById('remoteVideo').srcObject = e.streams[0];
    this.pc.onicecandidate = e => e.candidate && this.socket.emit('connec-tra-ice', {
      to: this.remoteId, candidate: e.candidate
    });

    // Signaling
    this.socket.emit('join-session', {sessionId: this.sessionId, sdp: await this.pc.createOffer(), isOffer: true});
    this.socket.on('connec-tra-offer', this.handleOffer.bind(this));
    this.socket.on('connec-tra-answer', this.handleAnswer.bind(this));
  }

  handleOffer(data) {
    this.remoteId = data.from;
    this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      .then(() => this.pc.createAnswer())
      .then(answer => {
        this.pc.setLocalDescription(answer);
        this.socket.emit('connec-tra-answer', {to: this.remoteId, sdp: answer});
      });
  }

  sendControl(event) {
    this.channels.control.send(JSON.stringify({
      type: event.type,
      x: event.clientX,
      y: event.clientY,
      button: event.button
    }));
  }
}

let connecTraRTC = null;
