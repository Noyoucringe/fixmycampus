import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { AuthPayload } from '@fixmycampus/shared';

export function createSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
        (socket as any).user = payload;
      } catch {
        // Allow unauthenticated connections for public map viewing
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.join('map');

    socket.on('join:department', (departmentId: string) => {
      socket.join(`dept:${departmentId}`);
    });

    socket.on('leave:department', (departmentId: string) => {
      socket.leave(`dept:${departmentId}`);
    });

    socket.on('disconnect', () => {
      // Cleanup handled by Socket.IO
    });
  });

  return io;
}
