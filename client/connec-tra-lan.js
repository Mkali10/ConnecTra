const mdns = require('mdns');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');

console.log('🌐 ConnecTra LAN Mode Starting...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// mDNS Discovery
const hostname = os.hostname();
const ad = mdns.createAdvertisement(mdns.tcp('connec-tra'), 8080, {
  name: `ConnecTra-LAN-${hostname}`,
  txtRecord: { version: '1.0', mode: 'lan' }
});
ad.start();

// Serve LAN client
app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log(`🔗 LAN Client ${socket.id} connected on ${hostname}`);
  
  socket.on('lan-session', (data) => {
    socket.join(data.sessionId);
    socket.to(data.sessionId).emit('lan-offer', { 
      sdp: data.sdp, 
      from: socket.id,
      hostname 
    });
  });

  socket.on('lan-ice', (data) => {
    socket.to(data.to).emit('lan-ice', { candidate: data.candidate });
  });

  socket.on('lan-control', (data) => {
    socket.to(data.sessionId).emit('lan-remote-control', data);
  });
});

server.listen(8080, '0.0.0.0', () => {
  console.log(`\n🌐 ConnecTra LAN Server: http://${os.networkInterfaces().en0?.[0]?.address || 'localhost'}:8080`);
  console.log('📱 Open same URL on all LAN devices');
  console.log('💡 No internet required!');
});
