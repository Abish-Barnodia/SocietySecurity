import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../utils/api';
import tokenStorage from '../utils/tokenStorage';
import { useAuth } from '@apartment-security/shared-auth';

// The socket.io server is attached to the same HTTP server as the REST API,
// listening at the origin root — strip the "/api/v1" API prefix to get it.
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

// Single shared socket connection for the whole app — previously each of
// DataContext/CommunityContext/ComplaintsContext/EventsContext/MaintenanceContext
// opened its own io() connection (5 handshakes/heartbeats per session for the
// same origin). Consumers attach/detach their own event listeners via
// socket.on/.off in their own effects; this context only owns the connection
// lifecycle.
const SocketContext = createContext<Socket | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'RESIDENT') return;
    let cancelled = false;

    (async () => {
      const token = await tokenStorage.getItemAsync('userToken');
      if (!token || cancelled) return;

      const s = io(SOCKET_URL, { auth: { token } });
      socketRef.current = s;
      setSocket(s);
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [isAuthenticated, userRole]);

  // A locked/backgrounded phone can silently drop the socket at the OS level
  // (RN pauses JS timers) — socket.io's own reconnect only notices once a
  // ping times out (tens of seconds by default), which reads as "the guard's
  // walk-in alert took forever to arrive." Forcing a reconnect check the
  // instant the app comes back to the foreground closes that gap.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    });
    return () => sub.remove();
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
