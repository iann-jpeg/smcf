// server.js (snippet)
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    // attach socket.io
    const { Server } = require('socket.io');
    const io = new Server(server, {
      cors: { origin: '*' } // tighten in production
    });

    // optionally namespace or auth here
    io.on('connection', (socket) => {
      console.log('Socket connected', socket.id);
    });

    // make io available to controllers via req.app.get('io')
    app.set('io', io);

    server.listen(PORT, () => {
      console.log(`SMCF backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();