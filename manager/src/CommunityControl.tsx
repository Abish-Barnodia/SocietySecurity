import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const senderLabel = (sender: any) => {
  const resident = sender?.resident;
  const name = resident?.name ?? sender?.manager?.name ?? sender?.role ?? 'Unknown';
  const unit = resident?.unit ? `${resident.unit.tower ? resident.unit.tower + ' ' : ''}${resident.unit.unitNumber}` : null;
  return unit ? `${name} · ${unit}` : name;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ATTACH_OPTIONS = [
  { key: 'media', label: 'Photo & Video', icon: 'photo', color: '#8B5CF6', accept: 'image/*,video/*' },
  { key: 'camera', label: 'Camera', icon: 'camera', color: '#EF4444', accept: 'image/*', capture: 'environment' },
  { key: 'document', label: 'Document', icon: 'file-text', color: '#3B82F6', accept: '.pdf,.doc,.docx,.txt,application/*' },
  { key: 'poll', label: 'Poll', icon: 'chart-bar', color: '#00C896' },
] as const;

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const groupReactions = (reactions: any[]) => {
  const byEmoji: Record<string, number> = {};
  (reactions || []).forEach((r: any) => { byEmoji[r.emoji] = (byEmoji[r.emoji] || 0) + 1; });
  return Object.entries(byEmoji);
};

function FeedTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [stagedItems, setStagedItems] = useState<{ file: File; url: string }[]>([]);
  const [stagedIndex, setStagedIndex] = useState(0);
  const [stagedCaption, setStagedCaption] = useState('');
  const [sendingStaged, setSendingStaged] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ message: any; x: number; y: number; openUpward: boolean } | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  const load = async (silent = false) => {
    try {
      const res = await fetch(`${API_BASE}/community/messages`, { headers: authHeaders() });
      const data = await res.json();
      setMessages((data.data?.messages || []).slice().reverse());
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, []);

  // Only auto-scroll to the bottom if the manager was already reading the
  // latest messages - otherwise deleting an older message (or a background
  // poll picking up someone else's new post) yanks their view away from
  // wherever they'd scrolled to, e.g. mid-delete on a message further up.
  const nearBottomRef = useRef(true);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    if (nearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/community/messages`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TEXT', body, replyToId: replyTo?.id }),
      });
      setDraft('');
      setReplyTo(null);
      await load();
    } finally {
      setSending(false);
    }
  };

  const toggleReactionOn = async (messageId: string, emoji: string) => {
    setContextMenu(null);
    try {
      await fetch(`${API_BASE}/community/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      await load();
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    setContextMenu(null);
    try {
      await fetch(`${API_BASE}/community/messages/${id}`, { method: 'DELETE', headers: authHeaders() });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {}
  };

  const openAttachPicker = (key: string) => {
    setAttachOpen(false);
    if (key === 'poll') { setPollOpen(true); return; }
    const opt = ATTACH_OPTIONS.find((o) => o.key === key)!;
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = ('accept' in opt && opt.accept) || '*/*';
    input.multiple = key !== 'camera';
    if ('capture' in opt && opt.capture) input.setAttribute('capture', opt.capture);
    else input.removeAttribute('capture');
    input.click();
  };

  const addMoreStaged = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = 'image/*,video/*,.pdf,.doc,.docx,.txt,application/*';
    input.multiple = true;
    input.removeAttribute('capture');
    input.click();
  };

  const uploadAndSend = async (file: File, durationSec?: number, caption?: string, replyToId?: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/community/uploads`, { method: 'POST', headers: authHeaders(), body: formData });
      const data = await res.json();
      if (!res.ok) { alert(`Upload failed: ${data.message || 'Unknown error'}`); return; }
      const { url, mimeType, fileName, sizeBytes } = data.data;
      const type = mimeType.startsWith('image/') ? 'IMAGE' : mimeType.startsWith('video/') ? 'VIDEO' : mimeType.startsWith('audio/') ? 'AUDIO' : 'FILE';
      const msgRes = await fetch(`${API_BASE}/community/messages`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, mediaUrl: url, mediaMimeType: mimeType, fileName, fileSizeBytes: sizeBytes, mediaDurationSec: durationSec, body: caption, replyToId }),
      });
      if (!msgRes.ok) { const d = await msgRes.json(); alert(`Failed to send: ${d.message || 'Unknown error'}`); return; }
      await load();
    } catch (err) {
      alert('Network error while uploading');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setStagedItems((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removeStaged = (idx: number) => {
    setStagedItems((prev) => {
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
    setStagedIndex((i) => Math.max(0, i - 1));
  };

  const discardStaged = () => {
    stagedItems.forEach((item) => URL.revokeObjectURL(item.url));
    setStagedItems([]);
    setStagedCaption('');
    setStagedIndex(0);
  };

  const sendStaged = async () => {
    if (stagedItems.length === 0 || sendingStaged) return;
    setSendingStaged(true);
    try {
      for (let i = 0; i < stagedItems.length; i++) {
        const isLast = i === stagedItems.length - 1;
        await uploadAndSend(stagedItems[i].file, undefined, isLast ? (stagedCaption.trim() || undefined) : undefined, isLast ? replyTo?.id : undefined);
      }
    } finally {
      stagedItems.forEach((item) => URL.revokeObjectURL(item.url));
      setStagedItems([]);
      setStagedCaption('');
      setStagedIndex(0);
      setSendingStaged(false);
      setReplyTo(null);
    }
  };

  const renderStagedPreview = (item: { file: File; url: string }) => {
    if (item.file.type.startsWith('image/')) {
      return <img src={item.url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />;
    }
    if (item.file.type.startsWith('video/')) {
      return <video src={item.url} controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <Icon name="file-text" size={48} />
        <span style={{ fontSize: 13 }}>{item.file.name}</span>
      </div>
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      alert('Microphone access denied or unavailable');
    }
  };

  const stopRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    const duration = recordSeconds;
    recorder.onstop = async () => {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordStreamRef.current = null;
      setRecording(false);
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      if (!send || chunks.length === 0) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      await uploadAndSend(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }), duration);
    };
    recorder.stop();
    mediaRecorderRef.current = null;
  };

  const submitPoll = async () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2 || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/community/messages`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'POLL', poll: { question, options } }),
      });
      if (!res.ok) { const d = await res.json(); alert(`Failed to create poll: ${d.message || 'Unknown error'}`); return; }
      setPollOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      await load();
    } finally {
      setSending(false);
    }
  };

  const bubbleMedia = (m: any) => {
    switch (m.type) {
      case 'IMAGE':
        return <img src={m.mediaUrl} alt="" style={{ maxWidth: 260, maxHeight: 320, borderRadius: 8, display: 'block', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(m.mediaUrl, '_blank')} />;
      case 'VIDEO':
        return <video src={m.mediaUrl} controls style={{ maxWidth: 260, maxHeight: 320, borderRadius: 8, display: 'block' }} />;
      case 'AUDIO':
        return <audio src={m.mediaUrl} controls style={{ width: 240 }} />;
      case 'FILE':
        return (
          <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', background: 'rgba(0,0,0,0.04)', padding: '10px 12px', borderRadius: 8 }}>
            <Icon name="file-text" size={22} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.fileName || 'Document'}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{formatSize(m.fileSizeBytes)}</div>
            </div>
          </a>
        );
      default:
        return null;
    }
  };

  const composer = (
    <div style={{ background: '#f0f2f5' }}>
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#e9edef', borderBottom: '1px solid #d1d7db' }}>
          <div style={{ borderLeft: '3px solid #00a884', paddingLeft: 8, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#008069' }}>{senderLabel(replyTo.sender)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>
              {replyTo.body || (replyTo.type === 'POLL' ? replyTo.poll?.question : replyTo.type)}
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} title="Cancel reply" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setAttachOpen((o) => !o)}
          title="Attach"
          disabled={uploading || recording}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid #d1d7db', background: '#ffffff', color: '#54656f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {uploading ? <Icon name="loader-2" className="spin" size={18} /> : <Icon name="plus" size={20} />}
        </button>
        {attachOpen && (
          <div style={{ position: 'absolute', bottom: 48, left: 0, background: '#ffffff', borderRadius: 12, padding: 14, display: 'flex', gap: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', border: '1px solid #e9edef', zIndex: 10 }}>
            {ATTACH_OPTIONS.map((opt) => (
              <button key={opt.key} onClick={() => openAttachPicker(opt.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#111b21', width: 64 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={opt.icon} size={20} color="white" />
                </span>
                <span style={{ fontSize: 11, textAlign: 'center' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChosen} />

      {recording ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', border: '1px solid #d1d7db', borderRadius: 20, padding: '10px 16px' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF4444' }} />
          <span style={{ color: '#111b21', fontSize: 14 }}>Recording… {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
        </div>
      ) : (
        <input
          type="text"
          placeholder="Message the community feed as Admin Manager…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          style={{ flex: 1, background: '#ffffff', border: '1px solid #d1d7db', borderRadius: 20, padding: '10px 16px', color: '#111b21', fontSize: 14, outline: 'none' }}
        />
      )}

      {recording && (
        <button
          onClick={() => stopRecording(false)}
          title="Cancel recording"
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid #d1d7db', background: '#ffffff', color: '#54656f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="trash" size={16} />
        </button>
      )}

      {draft.trim() && !recording ? (
        <button
          onClick={send}
          disabled={sending}
          style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="send" size={16} />
        </button>
      ) : (
        <button
          onClick={() => (recording ? stopRecording(true) : startRecording())}
          disabled={uploading}
          title={recording ? 'Stop and send' : 'Record a voice message'}
          style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: recording ? '#EF4444' : '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name={recording ? 'player-stop-filled' : 'microphone'} size={16} />
        </button>
      )}
      </div>
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }} onClick={() => attachOpen && setAttachOpen(false)}>
      {stagedItems.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: '#ffffff', zIndex: 20, display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <button onClick={discardStaged} title="Discard" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <Icon name="x" size={22} />
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stagedItems.length} selected</span>
            <button onClick={() => removeStaged(stagedIndex)} title="Remove this file" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <Icon name="trash" size={18} />
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 16, minHeight: 0 }}>
            {stagedItems[stagedIndex] && renderStagedPreview(stagedItems[stagedIndex])}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' }}>
            {stagedItems.map((item, idx) => (
              <button key={idx} onClick={() => setStagedIndex(idx)}
                style={{ width: 52, height: 52, borderRadius: 8, border: idx === stagedIndex ? '2px solid #00a884' : '1px solid var(--border-color)', padding: 0, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#f0f2f5' }}>
                {item.file.type.startsWith('image/') ? (
                  <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={item.file.type.startsWith('video/') ? 'video' : 'file-text'} size={20} color="#54656f" />
                  </div>
                )}
              </button>
            ))}
            <button onClick={addMoreStaged} title="Add more"
              style={{ width: 52, height: 52, borderRadius: 8, border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'none', flexShrink: 0 }}>
              <Icon name="plus" size={20} color="#54656f" />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Add a caption…"
              value={stagedCaption}
              onChange={(e) => setStagedCaption(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendStaged(); }}
              style={{ flex: 1, border: '1px solid #d1d7db', borderRadius: 20, padding: '10px 16px', fontSize: 14, outline: 'none' }}
            />
            <button onClick={sendStaged} disabled={sendingStaged}
              style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              {sendingStaged ? <Icon name="loader-2" className="spin" size={18} /> : <Icon name="send" size={18} />}
            </button>
          </div>
        </div>
      )}
      <div ref={scrollRef} onScroll={handleScroll} style={{ background: '#ffffff', height: 560, overflowY: 'auto', padding: '16px 0' }}>
        {loading ? (
          <div style={{ color: '#667781', textAlign: 'center', marginTop: 40, fontSize: 13 }}>Loading feed…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#667781', textAlign: 'center', marginTop: 40, fontSize: 13 }}>No messages in the community feed yet.</div>
        ) : (
          messages.map((m: any) => {
            const isOwn = m.sender?.role === 'MANAGER';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 10, padding: '0 16px' }}>
                <div style={{ maxWidth: '65%' }}>
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const x = Math.min(Math.max(e.clientX, 100), window.innerWidth - 100);
                      const openUpward = e.clientY > window.innerHeight - 220;
                      setContextMenu({ message: m, x, y: e.clientY, openUpward });
                    }}
                    style={{
                    background: isOwn ? '#d9fdd3' : '#f0f2f5',
                    color: '#111b21',
                    borderRadius: 8,
                    borderTopRightRadius: isOwn ? 2 : 8,
                    borderTopLeftRadius: isOwn ? 2 : 8,
                    padding: '6px 8px 5px',
                    fontSize: 13.5,
                    boxShadow: '0 1px 0.5px rgba(0,0,0,0.08)',
                  }}>
                    {!isOwn && (
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#008069', marginBottom: 3 }}>{senderLabel(m.sender)}</div>
                    )}

                    {m.replyTo && (
                      <div style={{ borderLeft: '3px solid #00a884', background: 'rgba(0,0,0,0.04)', borderRadius: 4, padding: '4px 8px', marginBottom: 5 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#008069' }}>{senderLabel(m.replyTo.sender)}</div>
                        <div style={{ fontSize: 11.5, color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.replyTo.body || m.replyTo.type}
                        </div>
                      </div>
                    )}

                    {m.type === 'TEXT' && (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '2px 4px' }}>{m.body}</div>
                    )}

                    {(m.type === 'IMAGE' || m.type === 'VIDEO' || m.type === 'AUDIO' || m.type === 'FILE') && (
                      <>
                        {bubbleMedia(m)}
                        {m.body && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '6px 4px 0' }}>{m.body}</div>}
                      </>
                    )}

                    {m.type === 'POLL' && m.poll && (
                      <div style={{ padding: '2px 4px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>{m.poll.question}</div>
                        {m.poll.options.map((o: any) => {
                          const total = m.poll.options.reduce((sum: number, x: any) => sum + x.votes.length, 0) || 1;
                          const pct = Math.round((o.votes.length / total) * 100);
                          return (
                            <div key={o.id} style={{ marginBottom: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                                <span>{o.text}</span>
                                <span style={{ color: 'rgba(0,0,0,0.55)' }}>{o.votes.length} vote{o.votes.length === 1 ? '' : 's'}</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: '#00a884' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {groupReactions(m.reactions).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {groupReactions(m.reactions).map(([emoji, count]) => (
                          <button key={emoji} onClick={() => toggleReactionOn(m.id, emoji)}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 10, padding: '1px 6px', fontSize: 11, cursor: 'pointer' }}>
                            <span>{emoji}</span><span style={{ color: 'rgba(0,0,0,0.55)' }}>{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 10.5, color: 'rgba(0,0,0,0.45)' }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {composer}

      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div style={{
            position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 30,
            display: 'flex', flexDirection: contextMenu.openUpward ? 'column-reverse' : 'column', gap: 6,
            transform: contextMenu.openUpward ? 'translate(-50%, calc(-100% - 8px))' : 'translate(-50%, 8px)',
          }}>
            <div style={{ display: 'flex', gap: 6, background: '#ffffff', borderRadius: 24, padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.22)' }}>
              {REACTION_EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => toggleReactionOn(contextMenu.message.id, emoji)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 2, lineHeight: 1 }}>
                  {emoji}
                </button>
              ))}
            </div>
            <div style={{ background: '#ffffff', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.22)', overflow: 'hidden', minWidth: 160 }}>
              <button onClick={() => { setReplyTo(contextMenu.message); setContextMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, color: '#111b21', textAlign: 'left' }}>
                <Icon name="corner-up-left" size={16} /> Reply
              </button>
              <button onClick={() => handleDelete(contextMenu.message.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, color: '#DC2626', textAlign: 'left', borderTop: '1px solid #f0f2f5' }}>
                <Icon name="trash" size={16} /> Delete
              </button>
            </div>
          </div>
        </>
      )}

      {pollOpen && (
        <div className="modal-overlay" onClick={() => !sending && setPollOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create Poll</h3>
                <p className="modal-subtitle">Ask the community a question.</p>
              </div>
              <button className="modal-close" onClick={() => setPollOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Question</label>
                <input className="form-input" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="e.g. Preferred maintenance day?" />
              </div>
              <div>
                <label className="form-label">Options</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" value={opt} onChange={(e) => setPollOptions((prev) => prev.map((o, i) => (i === idx ? e.target.value : o)))} placeholder={`Option ${idx + 1}`} />
                      {pollOptions.length > 2 && (
                        <button className="action-btn" onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))} title="Remove option">
                          <Icon name="x" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 10 && (
                  <button className="btn btn-outline" style={{ marginTop: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setPollOptions((prev) => [...prev, ''])}>
                    <Icon name="plus" size={14} /> Add option
                  </button>
                )}
              </div>
              <button className="btn btn-primary" onClick={submitPoll} disabled={sending || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}>
                {sending ? 'Posting…' : 'Post Poll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MembersTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`${API_BASE}/community/members/manage`, { headers: authHeaders() });
    const data = await res.json();
    setMembers(data.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleMute = async (m: any) => {
    setTogglingId(m.id);
    const muted = !m.muted;
    try {
      await fetch(`${API_BASE}/community/members/${m.id}/mute`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, muted } : x)));
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) return <div className="card">Loading members…</div>;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr className="table-header-row">
            {['Member', 'Unit', 'Role', 'Joined', 'Posts', 'Chat', 'Status'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m: any) => (
            <tr key={m.id} className="table-row">
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.name}</td>
              <td style={{ padding: '12px 16px' }}>{m.unit ? `${m.unit.tower ? m.unit.tower + ' ' : ''}${m.unit.unitNumber}` : '—'}</td>
              <td style={{ padding: '12px 16px' }}><span className="feed-meta-badge">{m.role}</span></td>
              <td style={{ padding: '12px 16px' }}>{new Date(m.joinedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td style={{ padding: '12px 16px' }}>{m.postCount}</td>
              <td style={{ padding: '12px 16px' }}>
                <button
                  onClick={() => toggleMute(m)}
                  disabled={togglingId === m.id}
                  title={m.muted ? 'Muted — click to allow posting' : 'Can post — click to mute'}
                  style={{
                    width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: m.muted ? '#CBD5E1' : 'var(--primary)', position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: m.muted ? 2 : 18, width: 16, height: 16,
                    borderRadius: '50%', background: 'white', transition: 'left 0.15s ease',
                  }} />
                </button>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span className={`status-badge-modern ${m.muted ? 'status-offline-modern' : 'status-on-post-modern'}`}>
                  {m.muted ? 'muted' : 'active'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CommunityControl: React.FC = () => {
  const [tab, setTab] = useState<'feed' | 'members'>('feed');

  const tabs: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: 'feed', label: 'Community Feed', icon: <Icon name="message" size={15} /> },
    { key: 'members', label: 'Members', icon: <Icon name="users" size={15} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ fontSize: 24 }}>Community Control</h1>
        <p className="page-subtitle">Community feed moderation, member management, flagged content review, and chat toggle administration</p>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 24, background: '#F1F5F9', padding: 4, borderRadius: 8 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'feed' && <FeedTab />}
      {tab === 'members' && <MembersTab />}
    </div>
  );
};

export default CommunityControl;
