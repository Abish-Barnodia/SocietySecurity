import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api, { API_URL } from '../utils/api';
import tokenStorage from '../utils/tokenStorage';
import { useAuth } from '@apartment-security/shared-auth';

// The socket.io server is attached to the same HTTP server as the REST API,
// listening at the origin root — strip the "/api/v1" API prefix to get it.
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'POLL';

export type PollOption = {
  id: string;
  text: string;
  order: number;
  voterIds: string[];
};

export type Poll = {
  id: string;
  question: string;
  allowMultiple: boolean;
  options: PollOption[];
};

export type ReplyPreview = {
  id: string;
  type: MessageType;
  body?: string;
  senderName: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderUnit?: string;
  senderRole?: string;
  isMine: boolean;
  type: MessageType;
  body?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaDurationSec?: number;
  fileName?: string;
  fileSizeBytes?: number;
  mentionedUserIds: string[];
  replyTo?: ReplyPreview | null;
  reactions: { emoji: string; userId: string }[];
  poll?: Poll | null;
  createdAt: string;
};

export type CommunityMember = {
  id: string;
  userId: string;
  name: string;
  unit?: string;
};

const formatUnit = (unit?: { unitNumber?: string; tower?: string | null } | null) => {
  if (!unit?.unitNumber) return undefined;
  return unit.tower ? `${unit.tower} - ${unit.unitNumber}` : unit.unitNumber;
};

const mapPoll = (raw: any): Poll => ({
  id: raw.id,
  question: raw.question,
  allowMultiple: raw.allowMultiple,
  options: (raw.options ?? [])
    .slice()
    .sort((a: any, b: any) => a.order - b.order)
    .map((o: any) => ({
      id: o.id,
      text: o.text,
      order: o.order,
      voterIds: (o.votes ?? []).map((v: any) => v.userId),
    })),
});

const mapMessage = (raw: any, myUserId: string | null): ChatMessage => ({
  id: raw.id,
  senderId: raw.senderId,
  senderName: raw.sender?.resident?.name ?? raw.sender?.manager?.name ?? 'Resident',
  senderUnit: formatUnit(raw.sender?.resident?.unit),
  senderRole: raw.sender?.role ?? undefined,
  isMine: raw.senderId === myUserId,
  type: raw.type,
  body: raw.body ?? undefined,
  mediaUrl: raw.mediaUrl ?? undefined,
  mediaMimeType: raw.mediaMimeType ?? undefined,
  mediaDurationSec: raw.mediaDurationSec ?? undefined,
  fileName: raw.fileName ?? undefined,
  fileSizeBytes: raw.fileSizeBytes ?? undefined,
  mentionedUserIds: raw.mentionedUserIds ?? [],
  replyTo: raw.replyTo
    ? {
        id: raw.replyTo.id,
        type: raw.replyTo.type,
        body: raw.replyTo.body ?? undefined,
        senderName: raw.replyTo.sender?.resident?.name ?? raw.replyTo.sender?.manager?.name ?? 'Resident',
      }
    : null,
  reactions: (raw.reactions ?? []).map((r: any) => ({ emoji: r.emoji, userId: r.userId })),
  poll: raw.poll ? mapPoll(raw.poll) : null,
  createdAt: raw.createdAt,
});

type SendMediaOptions = {
  replyToId?: string;
  durationSec?: number;
};

type CommunityContextType = {
  messages: ChatMessage[];
  members: CommunityMember[];
  loadingInitial: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  typingUsers: string[];
  searchResults: ChatMessage[];
  searching: boolean;
  fetchMessages: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  sendTextMessage: (body: string, replyToId?: string, mentionedUserIds?: string[]) => Promise<void>;
  sendMediaMessage: (
    type: Exclude<MessageType, 'TEXT' | 'POLL'>,
    localUri: string,
    mimeType: string,
    fileName: string,
    options?: SendMediaOptions
  ) => Promise<void>;
  createPoll: (question: string, options: string[], allowMultiple: boolean, replyToId?: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  votePoll: (pollId: string, optionId: string) => Promise<void>;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  emitTyping: () => void;
};

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isOnboarded, userId, userRole } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const myUserIdRef = useRef<string | null>(userId);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    myUserIdRef.current = userId;
  }, [userId]);

  const fetchMessages = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const response = await api.get('/community/messages');
      const { messages: raw, nextCursor } = response.data.data;
      setMessages((raw as any[]).map((m) => mapMessage(m, myUserIdRef.current)));
      cursorRef.current = nextCursor;
      setHasMore(!!nextCursor);
    } catch (error) {
      console.error('Failed to fetch community messages:', error);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const fetchOlderMessages = useCallback(async () => {
    if (!cursorRef.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await api.get('/community/messages', { params: { cursor: cursorRef.current } });
      const { messages: raw, nextCursor } = response.data.data;
      setMessages((prev) => [...prev, ...(raw as any[]).map((m) => mapMessage(m, myUserIdRef.current))]);
      cursorRef.current = nextCursor;
      setHasMore(!!nextCursor);
    } catch (error) {
      console.error('Failed to fetch older community messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder]);

  const fetchMembers = useCallback(async () => {
    try {
      const response = await api.get('/community/members');
      const raw: any[] = response.data.data ?? [];
      setMembers(raw.map((r) => ({ id: r.id, userId: r.userId, name: r.name, unit: formatUnit(r.unit) })));
    } catch (error) {
      console.error('Failed to fetch community members:', error);
    }
  }, []);

  const postMessage = useCallback(async (payload: Record<string, unknown>) => {
    const response = await api.post('/community/messages', payload);
    const mapped = mapMessage(response.data.data, myUserIdRef.current);
    setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [mapped, ...prev]));
    return mapped;
  }, []);

  const sendTextMessage = useCallback(
    async (body: string, replyToId?: string, mentionedUserIds?: string[]) => {
      if (!body.trim()) return;
      await postMessage({ type: 'TEXT', body: body.trim(), replyToId, mentionedUserIds });
    },
    [postMessage]
  );

  const uploadMedia = async (localUri: string, mimeType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: fileName || `community-${Date.now()}.jpg`,
      type: mimeType || 'image/jpeg',
    } as any);
    const response = await api.post('/community/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(data) => data],
    });
    return response.data.data as { url: string; mimeType: string; sizeBytes: number; fileName: string };
  };

  const sendMediaMessage = useCallback(
    async (
      type: Exclude<MessageType, 'TEXT' | 'POLL'>,
      localUri: string,
      mimeType: string,
      fileName: string,
      options?: SendMediaOptions
    ) => {
      const uploaded = await uploadMedia(localUri, mimeType, fileName);
      await postMessage({
        type,
        mediaUrl: uploaded.url,
        mediaMimeType: uploaded.mimeType,
        fileName: uploaded.fileName,
        fileSizeBytes: uploaded.sizeBytes,
        mediaDurationSec: options?.durationSec,
        replyToId: options?.replyToId,
      });
    },
    [postMessage]
  );

  const createPoll = useCallback(
    async (question: string, options: string[], allowMultiple: boolean, replyToId?: string) => {
      const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
      if (!question.trim() || cleanOptions.length < 2) return;
      await postMessage({
        type: 'POLL',
        poll: { question: question.trim(), options: cleanOptions, allowMultiple },
        replyToId,
      });
    },
    [postMessage]
  );

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const response = await api.post(`/community/messages/${messageId}/reactions`, { emoji });
    const reactions: { emoji: string; userId: string }[] = response.data.data ?? [];
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    await api.delete(`/community/messages/${messageId}`);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const votePoll = useCallback(async (pollId: string, optionId: string) => {
    const response = await api.post(`/community/polls/${pollId}/vote`, { optionId });
    const options = mapPoll({ id: pollId, options: response.data.data }).options;
    setMessages((prev) =>
      prev.map((m) => (m.poll?.id === pollId ? { ...m, poll: { ...m.poll!, options } } : m))
    );
  }, []);

  const searchMessages = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await api.get('/community/search', { params: { q: query.trim() } });
      const raw: any[] = response.data.data ?? [];
      setSearchResults(raw.map((m) => mapMessage(m, myUserIdRef.current)));
    } catch (error) {
      console.error('Failed to search community messages:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => setSearchResults([]), []);

  const emitTyping = useCallback(() => {
    // The server resolves the sender's own property room server-side, so no
    // payload is needed here.
    socketRef.current?.emit('community:typing');
  }, []);

  // Only hit protected endpoints / open the socket once logged in AND onboarded
  // — and only for residents, since community endpoints are RESIDENT-only and
  // guard accounts would otherwise fire requests that always 403.
  useEffect(() => {
    if (!isAuthenticated || !isOnboarded || userRole !== 'RESIDENT') return;
    fetchMessages();
    fetchMembers();
  }, [isAuthenticated, isOnboarded, userRole, fetchMessages, fetchMembers]);

  useEffect(() => {
    if (!isAuthenticated || !isOnboarded || userRole !== 'RESIDENT') return;
    let cancelled = false;

    (async () => {
      const token = await tokenStorage.getItemAsync('userToken');
      if (!token || cancelled) return;

      const socket = io(SOCKET_URL, { auth: { token } });
      socketRef.current = socket;

      socket.on('community:message:new', (raw: any) => {
        const mapped = mapMessage(raw, myUserIdRef.current);
        setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [mapped, ...prev]));
      });

      socket.on('community:reaction:update', ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, reactions: reactions.map((r) => ({ emoji: r.emoji, userId: r.userId })) }
              : m
          )
        );
      });

      socket.on('community:message:delete', ({ messageId }: { messageId: string }) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      });

      socket.on('community:poll:vote', ({ pollId, options }: { pollId: string; options: any[] }) => {
        const mappedOptions = mapPoll({ id: pollId, options }).options;
        setMessages((prev) =>
          prev.map((m) => (m.poll?.id === pollId ? { ...m, poll: { ...m.poll!, options: mappedOptions } } : m))
        );
      });

      socket.on('community:typing', ({ userId: typingUserId }: { userId: string }) => {
        if (typingUserId === myUserIdRef.current) return;
        setTypingUsers((prev) => (prev.includes(typingUserId) ? prev : [...prev, typingUserId]));
        clearTimeout(typingTimeoutsRef.current[typingUserId]);
        typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== typingUserId));
        }, 3000);
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, isOnboarded]);

  return (
    <CommunityContext.Provider
      value={{
        messages,
        members,
        loadingInitial,
        loadingOlder,
        hasMore,
        typingUsers,
        searchResults,
        searching,
        fetchMessages,
        fetchOlderMessages,
        fetchMembers,
        sendTextMessage,
        sendMediaMessage,
        createPoll,
        toggleReaction,
        deleteMessage,
        votePoll,
        searchMessages,
        clearSearch,
        emitTyping,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (context === undefined) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
};
