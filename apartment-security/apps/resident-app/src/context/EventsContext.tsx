import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '@apartment-security/shared-auth';
import { useSocket } from './SocketContext';

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
  lastFetchedAt: React.MutableRefObject<number>;
};

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchedAt = useRef(0);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/events');
      const raw: any[] = response.data.data ?? [];
      setEvents(raw.map(mapEvent));
      lastFetchedAt.current = Date.now();
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
  const socket = useSocket();
  useEffect(() => {
    if (!socket || userRole !== 'RESIDENT') return;

    const upsert = (raw: any) => {
      const mapped = mapEvent(raw);
      setEvents((prev) =>
        prev.some((e) => e.id === mapped.id) ? prev.map((e) => (e.id === mapped.id ? mapped : e)) : [mapped, ...prev]
      );
    };
    socket.on('event:new', upsert);
    socket.on('event:update', upsert);

    return () => {
      socket.off('event:new', upsert);
      socket.off('event:update', upsert);
    };
  }, [socket, userRole]);

  const value = useMemo<EventsContextType>(() => ({
    events, loading, fetchEvents, rsvp, lastFetchedAt,
  }), [events, loading, fetchEvents, rsvp]);

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};
