import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useChat } from './ChatProvider';
import { ChatAvatar, fmtTime, fmtDay, renderBody, isImage, fileUrl, QUICK_EMOJIS } from './chatUtils';
import MGUnfurl, { extractRefs } from './MGUnfurl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Send, Paperclip, Smile, X, Pencil, Trash2, SmilePlus, Hash, Lock, FileText, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

function Reactions({ msg, onReact, meId }) {
  const entries = Object.entries(msg.reactions || {}).filter(([, u]) => u.length);
  if (!entries.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([emoji, users]) => (
        <button key={emoji} onClick={() => onReact(msg.id, emoji)}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${users.includes(meId) ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-muted/40 text-muted-foreground'}`}>
          <span>{emoji}</span><span>{users.length}</span>
        </button>
      ))}
    </div>
  );
}

function MessageRow({ msg, prev, meId, onReact, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const grouped = prev && prev.sender_id === msg.sender_id
    && (new Date(msg.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000 && !prev.deleted;
  if (msg.deleted) {
    return <div className="px-3 py-0.5 text-[12px] italic text-muted-foreground/60">message deleted</div>;
  }
  return (
    <div className="group relative px-3 py-0.5 hover:bg-accent/40" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="flex gap-2.5">
        {grouped ? <div className="w-9 flex-shrink-0 text-[10px] text-transparent group-hover:text-muted-foreground/60 text-right pr-1 pt-1">{fmtTime(msg.created_at)}</div>
          : <ChatAvatar id={msg.sender_id} name={msg.sender_name} size={36} />}
        <div className="min-w-0 flex-1">
          {!grouped && (
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-foreground">{msg.sender_name}</span>
              {msg.is_system && <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">bot</span>}
              <span className="text-[10px] text-muted-foreground">{fmtTime(msg.created_at)}</span>
              {msg.edited_at && <span className="text-[10px] text-muted-foreground/60">(edited)</span>}
            </div>
          )}
          {msg.body && <div className="text-[13px] leading-relaxed text-foreground/90 break-words">{renderBody(msg.body)}</div>}
          {(msg.attachments || []).map((att, i) => (
            <div key={i} className="mt-1">
              {isImage(att) ? (
                <a href={fileUrl(att)} target="_blank" rel="noopener noreferrer">
                  <img src={fileUrl(att)} alt={att.name} className="max-h-60 rounded-md border border-border" />
                </a>
              ) : (
                <a href={fileUrl(att)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[12px] hover:bg-muted">
                  <FileText className="h-4 w-4 text-primary" /> {att.name || 'file'}
                </a>
              )}
            </div>
          ))}
          {extractRefs(msg.body).map((r) => <MGUnfurl key={r} refStr={r} />)}
          <Reactions msg={msg} onReact={onReact} meId={meId} />
        </div>
      </div>
      {hover && (
        <div className="absolute -top-2 right-2 flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow">
          <Popover>
            <PopoverTrigger asChild>
              <button className="rounded p-1 text-muted-foreground hover:text-foreground"><SmilePlus className="h-3.5 w-3.5" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1"><div className="flex gap-0.5">
              {QUICK_EMOJIS.map((e) => <button key={e} onClick={() => onReact(msg.id, e)} className="rounded p-1 text-base hover:bg-accent">{e}</button>)}
            </div></PopoverContent>
          </Popover>
          {msg.sender_id === meId && (
            <>
              <button onClick={() => onEdit(msg)} className="rounded p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => onDelete(msg.id)} className="rounded p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatConversation({ compact = false }) {
  const chat = useChat();
  const { activeId, channels, messages, directory, typing, user } = chat;
  const channel = channels.find((c) => c.id === activeId);
  const msgs = messages[activeId] || [];
  const [text, setText] = useState('');
  const [pending, setPending] = useState([]);     // pending attachments
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mentionQ, setMentionQ] = useState(null); // {query} when typing @
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const typingThrottle = useRef(0);

  const atBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length, activeId]);

  const mentionMatches = useMemo(() => {
    if (mentionQ == null) return [];
    const q = mentionQ.toLowerCase();
    return directory.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQ, directory]);

  if (!activeId || !channel) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a conversation</div>;
  }

  const onScroll = async () => {
    const el = scrollRef.current; if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40) {
      const prevH = el.scrollHeight;
      const n = await chat.loadOlder(activeId);
      if (n) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevH; });
    }
  };

  const onChange = (e) => {
    const v = e.target.value; setText(v);
    const m = /(^|\s)@([\w]*)$/.exec(v.slice(0, e.target.selectionStart));
    setMentionQ(m ? m[2] : null);
    const now = Date.now();
    if (now - typingThrottle.current > 2500) { typingThrottle.current = now; chat.sendTyping(activeId); }
  };

  const pickMention = (u) => {
    setText((t) => t.replace(/(^|\s)@([\w]*)$/, `$1@${u.name} `));
    setMentionQ(null);
  };

  const onFiles = async (files) => {
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name} exceeds 25MB`); continue; }
        const att = await chat.uploadFile(f);
        setPending((p) => [...p, att]);
      }
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const send = async () => {
    const body = text.trim();
    if (!body && !pending.length) return;
    if (editing) {
      await chat.editMessage(editing.id, body); setEditing(null); setText(''); return;
    }
    const mentions = directory.filter((u) => body.includes(`@${u.name}`)).map((u) => u.id);
    setText(''); const atts = pending; setPending([]);
    atBottom.current = true;
    try { await chat.sendMessage(activeId, body, atts, mentions); }
    catch { toast.error('Failed to send'); setText(body); setPending(atts); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && mentionQ == null) { e.preventDefault(); send(); }
    if (e.key === 'Escape' && editing) { setEditing(null); setText(''); }
  };
  const startEdit = (m) => { setEditing(m); setText(m.body || ''); };

  const typers = Object.values(typing[activeId] || {}).filter((t) => t.name && t.name !== chat.user?.name).map((t) => t.name);

  // group day separators
  let lastDay = null;

  return (
    <div className="flex h-full flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files); }}>
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {channel.type === 'dm' ? <ChatAvatar id={channel.dm_user?.id} name={channel.name} online={channel.dm_user?.online} size={28} />
          : (channel.is_private ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Hash className="h-4 w-4 text-muted-foreground" />)}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{channel.name}</p>
          {channel.type !== 'dm' && channel.topic && <p className="truncate text-[11px] text-muted-foreground">{channel.topic}</p>}
          {channel.type === 'dm' && <p className="text-[11px] text-muted-foreground">{channel.dm_user?.online ? 'Active now' : 'Offline'}</p>}
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-2">
        {msgs.map((m, i) => {
          const day = fmtDay(m.created_at);
          const sep = day !== lastDay; lastDay = day;
          return (
            <React.Fragment key={m.id}>
              {sep && <div className="my-2 flex items-center gap-2 px-3"><div className="h-px flex-1 bg-border" /><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{day}</span><div className="h-px flex-1 bg-border" /></div>}
              <MessageRow msg={m} prev={sep ? null : msgs[i - 1]} meId={user.id} onReact={chat.react} onEdit={startEdit} onDelete={chat.deleteMessage} />
            </React.Fragment>
          );
        })}
        {!msgs.length && <div className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello 👋</div>}
      </div>

      {/* typing */}
      <div className="h-4 px-4 text-[11px] text-muted-foreground">
        {typers.length > 0 && `${typers.slice(0, 2).join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing…`}
      </div>

      {/* composer */}
      <div className="relative border-t border-border p-2">
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-full left-2 mb-1 w-56 overflow-hidden rounded-md border border-border bg-card shadow-lg">
            {mentionMatches.map((u) => (
              <button key={u.id} onClick={() => pickMention(u)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent">
                <ChatAvatar id={u.id} name={u.name} online={u.online} size={22} /> <span className="truncate">{u.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground capitalize">{u.role?.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {pending.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px]">
                {isImage(a) ? '🖼' : '📎'} {a.name}
                <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        {editing && <div className="mb-1 flex items-center gap-2 text-[11px] text-amber-400">Editing message <button onClick={() => { setEditing(null); setText(''); }} className="underline">cancel</button></div>}
        <div className="flex items-end gap-1.5">
          <button onClick={() => fileRef.current?.click()} className="rounded p-2 text-muted-foreground hover:text-foreground" title="Attach">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
          <Popover>
            <PopoverTrigger asChild><button className="rounded p-2 text-muted-foreground hover:text-foreground" title="Emoji"><Smile className="h-4 w-4" /></button></PopoverTrigger>
            <PopoverContent className="w-auto p-1"><div className="flex flex-wrap gap-0.5" style={{ maxWidth: 200 }}>
              {QUICK_EMOJIS.map((e) => <button key={e} onClick={() => setText((t) => t + e)} className="rounded p-1 text-lg hover:bg-accent">{e}</button>)}
            </div></PopoverContent>
          </Popover>
          <textarea
            value={text} onChange={onChange} onKeyDown={onKey} rows={compact ? 1 : 1}
            placeholder={`Message ${channel.type === 'dm' ? channel.name : '#' + (channel.slug || channel.name)}…`}
            className="max-h-28 min-h-[38px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={send} disabled={!text.trim() && !pending.length}
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
