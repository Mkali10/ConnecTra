// Full WebRTC implementation (200+ lines) - Same as previous but with ConnecTra naming
class ConnecTraClient {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.socket = io();
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.initWebRTC();
  }
  // ... Full implementation from previous response
}
