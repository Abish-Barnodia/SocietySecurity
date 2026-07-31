import { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { connectSocket } from '../../utils/socket';

type Sender = {
  id: string;
  role: string;
  resident: { name: string; unit: { unitNumber: string; tower: string | null } | null } | null;
};

type PollOption = { id: string; text: string; order: number; votes: { userId: string }[] };

type Message = {
  id: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'POLL';
  body: string | null;
  mediaUrl: string | null;
  fileName: string | null;
  createdAt: string;
  sender: Sender;
  reactions: { emoji: string }[];
  poll: { id: string; question: string; options: PollOption[] } | null;
};

const senderLabel = (s: Sender) => {
  const name = s.resident?.name ?? s.role;
  const unit = s.resident?.unit ? `${s.resident.unit.tower ? s.resident.unit.tower + ' ' : ''}${s.resident.unit.unitNumber}` : null;
  return unit ? `${name} · ${unit}` : name;
};

const MEDIA_LABEL: Record<string, string> = { IMAGE: '📷 Photo', VIDEO: '🎬 Video', AUDIO: '🎤 Voice note', FILE: '📎 File' };

export default function CommunityFeedTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  useEffect(() => {
    api.get('/community/messages').then((res) => {
      setMessages(res.data.data.messages ?? []);
      setLoading(false);
    });

    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('community:message:new', (message: Message) => {
      setMessages((prev) => (prev.find((m) => m.id === message.id) ? prev : [message, ...prev]));
    });
    socket.on('community:message:delete', ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });
    socket.on('community:reaction:update', ({ messageId, reactions }: { messageId: string; reactions: { emoji: string }[] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/community/messages/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading feed…</p>;
  if (messages.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No messages in the community feed yet.</p>;

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <span style={styles.sender}>{senderLabel(m.sender)}</span>
              <span style={styles.time}>{new Date(m.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <button style={styles.deleteButton} onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}>
              {deletingId === m.id ? '…' : 'Hide'}
            </button>
          </div>

          {m.type === 'TEXT' && <p style={styles.body}>{m.body}</p>}

          {m.type !== 'TEXT' && m.type !== 'POLL' && (
            <a href={m.mediaUrl ?? '#'} target="_blank" rel="noreferrer" style={styles.mediaChip}>
              {MEDIA_LABEL[m.type]}{m.fileName ? ` · ${m.fileName}` : ''}
            </a>
          )}

          {m.type === 'POLL' && m.poll && (
            <div>
              <p style={{ ...styles.body, fontWeight: 700 }}>{m.poll.question}</p>
              {m.poll.options.map((o) => (
                <div key={o.id} style={styles.pollOption}>
                  <span>{o.text}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{o.votes.length} vote{o.votes.length === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}

          {m.reactions.length > 0 && (
            <div style={styles.reactionRow}>
              {Object.entries(
                m.reactions.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] ?? 0) + 1 }), {})
              ).map(([emoji, count]) => (
                <span key={emoji} style={styles.reactionPill}>{emoji} {count}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
    padding: 16, marginBottom: 12,
  },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  sender: { fontWeight: 700, fontSize: 13.5, color: 'var(--text)' },
  time: { fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 },
  body: { fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.5 },
  mediaChip: {
    display: 'inline-block', fontSize: 13, color: 'var(--accent-dark)', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', textDecoration: 'none',
  },
  pollOption: {
    display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0',
    borderTop: '1px solid var(--border)',
  },
  reactionRow: { display: 'flex', gap: 6, marginTop: 10 },
  reactionPill: {
    fontSize: 12, background: 'var(--neutral-bg)', borderRadius: 999, padding: '3px 8px',
  },
  deleteButton: {
    fontSize: 12, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-bg)',
    border: 'none', borderRadius: 8, padding: '5px 12px', flexShrink: 0,
  },
};
