import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import api, { API_URL } from '../utils/api';
import tokenStorage from '../utils/tokenStorage';
import { useAuth } from '@apartment-security/shared-auth';

const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

export type RsvpStatus = 'GOING' | 'MAYBE' | 'DECLINED';

export type EventItem = {
  id: string;
  title: string;
  description: string;
  location?: string;
  startDate: string;
  endDate: string;
  status: string;
  myRsvp: RsvpStatus | null;
  rsvpCount: number;
};

const mapEvent = (raw: any): EventItem => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  location: raw.location ?? undefined,
  startDate: raw.startDate,
  endDate: raw.endDate,
  status: raw.status,
  myRsvp: raw.rsvps?.[0]?.status ?? null,
  rsvpCount: raw._count?.rsvps ?? 0,
});

type EventsContextType = {
  events: EventItem[];
  loading: boolean;
  fetchEvents: () => Promise<void>;
  rsvp: (eventId: string, status: RsvpStatus) => Promise<void>;
};

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/events');
      const raw: any[] = response.data.data ?? [];
      setEvents(raw.map(mapEvent));
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const rsvp = useCallback(async (eventId: string, status: RsvpStatus) => {
    await api.post(`/events/${eventId}/rsvp`, { status });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, myRsvp: status } : e)));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'RESIDENT') {
      fetchEvents();
    }
  }, [isAuthenticated, userRole, fetchEvents]);

  // Manager-created/updated events show up live for residents browsing the tab.
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'RESIDENT') return;
    let cancelled = false;

    (async () => {
      const token = await tokenStorage.getItemAsync('userToken');
      if (!token || cancelled) return;

      const socket = io(SOCKET_URL, { auth: { token } });
      socketRef.current = socket;

      const upsert = (raw: any) => {
        const mapped = mapEvent(raw);
        setEvents((prev) =>
          prev.some((e) => e.id === mapped.id) ? prev.map((e) => (e.id === mapped.id ? mapped : e)) : [mapped, ...prev]
        );
      };
      socket.on('event:new', upsert);
      socket.on('event:update', upsert);
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, userRole]);

  return (
    <EventsContext.Provider value={{ events, loading, fetchEvents, rsvp }}>
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};
