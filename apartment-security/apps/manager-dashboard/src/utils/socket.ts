import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

export function connectSocket(): Socket {
  const token = localStorage.getItem('managerToken');
  return io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
}
