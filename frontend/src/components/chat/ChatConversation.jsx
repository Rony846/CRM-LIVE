import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useChat } from './ChatProvider';
import { ChatAvatar, fmtTime, fmtDay, renderBody, isImage, fileUrl, QUICK_EMOJIS } from './chatUtils';
import MGUnfurl, { extractRefs } from './MGUnfurl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Send, Paperclip, Smile, X, Pencil, Trash2, SmilePlus, Hash, Lock, FileText, Loader2,
  Pin, Bookmark, BellOff, Bell, Settings2, BellRing, Check, Search, Ticket as TicketIcon, CheckCheck, Clock, BarChart3, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

const CAN_EDIT_CHANNEL = ['admin', 'supervisor'];

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

function PollCard({ poll, meId, meRole, onVote, onClose }) {
  const total = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
  const canClose = !poll.closed && (poll.created_by === meId || meRole === 'admin');
  return (
    <div className="mt-1 max-w-md rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold text-foreground">{poll.question}</span>
        {poll.closed && <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">Closed</span>}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((o) => {
          const n = o.votes?.length || 0; const pct = total ? Math.round((n / total) * 100) : 0; const mine = (o.votes || []).includes(meId);
          return (
            <button key={o.id} disabled={poll.closed} onClick={() => onVote(o.id)}
              className={`relative w-full overflow-hidden rounded-md border px-2.5 py-1.5 text-left text-[12px] ${mine ? 'border-primary/50' : 'border-border'} ${poll.closed ? 'cursor-default' : 'hover:border-primary/40'}`}>
              <div className="absolute inset-y-0 left-0 bg-primary/15 transition-all" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">{mine && <Check className="h-3 w-3 text-primary" />}{o.text}</span>
                <span className="text-muted-foreground">{n} · {pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{total} vote{total !== 1 ? 's' : ''}{poll.multi ? ' · multiple choice' : ''}</span>
        {canClose && <button onClick={onClose} className="underline hover:text-foreground">Close poll</button>}
      </div>
    </div>
  );
}

const TICKET_FROM_CHAT_ROLES = ['admin', 'call_support', 'supervisor'];

function MessageRow({ msg, prev, meId, meRole, onReact, onEdit, onDelete, onAction, onPin, onSave, isSaved, directory, onNudge, onResolveNudge, onToTicket, onRequestAck, onAck, onVote, onClosePoll }) {
  const [hover, setHover] = useState(false);
  const [nOpen, setNOpen] = useState(false);
  const [nivl, setNivl] = useState(15);
  const [nEsc, setNEsc] = useState(3);
  const [nq, setNq] = useState('');
  const [aOpen, setAOpen] = useState(false);
  const [aSel, setASel] = useState(() => new Set());
  const [aq, setAq] = useState('');
  const canCloseNudge = msg.nudge && (meId === msg.nudge.assignee_id || meId === msg.nudge.creator_id || meRole === 'admin');
  const ack = msg.ack;
  const ackedIds = new Set((ack?.acked || []).map((a) => a.id));
  const ackPending = (ack?.required || []).filter((id) => !ackedIds.has(id)).map((id) => ack.required_names?.[id] || 'someone');
  const iMustAck = ack && (ack.required || []).includes(meId) && !ackedIds.has(meId);
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
          {msg.pinned && <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-400"><Pin className="h-3 w-3" /> Pinned</div>}
          {msg.poll ? (
            <PollCard poll={msg.poll} meId={meId} meRole={meRole} onVote={(oid) => onVote(msg.id, oid)} onClose={() => onClosePoll(msg.id)} />
          ) : msg.body && (
            msg.is_action
              ? <div className="text-[13px] italic text-muted-foreground break-words">{msg.sender_name} {msg.body}</div>
              : <div className="text-[13px] leading-relaxed text-foreground/90 break-words">{renderBody(msg.body)}</div>
          )}
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
          {msg.action && msg.action.status === 'pending' && (
            <div className="mt-1.5 flex items-center gap-2">
              {(msg.action.allowed_roles || []).includes(meRole) ? (
                <>
                  <button onClick={() => onAction(msg.id, true)}
                    className="rounded bg-[#a4d64c]/15 px-2.5 py-1 text-[12px] font-medium text-[#a4d64c] ring-1 ring-[#a4d64c]/30 hover:bg-[#a4d64c]/25 capitalize">Confirm {msg.action.verb}</button>
                  <button onClick={() => onAction(msg.id, false)}
                    className="rounded bg-muted/50 px-2.5 py-1 text-[12px] text-muted-foreground ring-1 ring-border hover:bg-muted">Cancel</button>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Awaiting confirmation from: {(msg.action.allowed_roles || []).map((r) => r.replace('_', ' ')).join(', ')}</span>
              )}
            </div>
          )}
          {msg.nudge && (
            <div className={`mt-1.5 inline-flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-[11px] ${msg.nudge.status === 'active' ? 'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30' : 'bg-muted/40 text-muted-foreground'}`}>
              {msg.nudge.status === 'active' ? <BellRing className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {msg.nudge.status === 'active' ? (
                <>
                  <span>Follow-up: <b>{msg.nudge.assignee_name}</b> · every {msg.nudge.interval_min}m{msg.nudge.fired_count ? ` · pinged ${msg.nudge.fired_count}×` : ''}</span>
                  {msg.nudge.escalated && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-bold text-amber-200">⚠️ escalated</span>}
                  {canCloseNudge && (
                    <button onClick={() => onResolveNudge(msg.nudge.id)} className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 font-medium hover:bg-amber-400/30">Mark done</button>
                  )}
                </>
              ) : <span>Follow-up done{msg.nudge.done_by_name ? ` by ${msg.nudge.done_by_name}` : ''}</span>}
            </div>
          )}
          {msg.ticket && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-sky-400/10 px-2 py-1 text-[11px] text-sky-300 ring-1 ring-sky-400/30">
              <TicketIcon className="h-3.5 w-3.5" /> Ticket <b>{msg.ticket.ticket_number}</b> raised{msg.ticket.by_name ? ` by ${msg.ticket.by_name}` : ''}
            </div>
          )}
          {ack && (
            <div className="mt-1.5 inline-flex flex-wrap items-center gap-2 rounded-md bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300 ring-1 ring-emerald-400/30">
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Acknowledged {(ack.acked || []).length}/{(ack.required || []).length}{ackPending.length ? ` · pending: ${ackPending.slice(0, 3).join(', ')}${ackPending.length > 3 ? '…' : ''}` : ' · all done'}</span>
              {iMustAck && (
                <button onClick={() => onAck(msg.id)} className="ml-1 rounded bg-emerald-400/20 px-1.5 py-0.5 font-medium hover:bg-emerald-400/30">Acknowledge</button>
              )}
            </div>
          )}
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
          <button onClick={() => onSave(msg.id)} className={`rounded p-1 hover:text-foreground ${isSaved ? 'text-primary' : 'text-muted-foreground'}`} title={isSaved ? 'Unsave' : 'Save'}><Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} /></button>
          <button onClick={() => onPin(msg.id)} className={`rounded p-1 hover:text-foreground ${msg.pinned ? 'text-amber-400' : 'text-muted-foreground'}`} title={msg.pinned ? 'Unpin' : 'Pin'}><Pin className="h-3.5 w-3.5" /></button>
          <Popover open={nOpen} onOpenChange={setNOpen}>
            <PopoverTrigger asChild>
              <button className={`rounded p-1 hover:text-foreground ${msg.nudge?.status === 'active' ? 'text-amber-400' : 'text-muted-foreground'}`} title="Set follow-up reminder"><BellRing className="h-3.5 w-3.5" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Follow-up reminder</p>
              <div className="mb-2 flex gap-1">
                {[15, 30, 60].map((m) => (
                  <button key={m} onClick={() => setNivl(m)} className={`flex-1 rounded px-2 py-1 text-[11px] ${nivl === m ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'}`}>{m < 60 ? `${m}m` : '1h'}</button>
                ))}
              </div>
              <div className="mb-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Escalate to supervisor after</span>
                <div className="mt-1 flex gap-1">
                  {[[0, 'Off'], [3, '3 misses'], [5, '5 misses']].map(([v, l]) => (
                    <button key={v} onClick={() => setNEsc(v)} className={`flex-1 rounded px-2 py-1 text-[11px] ${nEsc === v ? 'bg-amber-400/80 text-black' : 'bg-muted/50 text-muted-foreground'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="relative mb-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input value={nq} onChange={(e) => setNq(e.target.value)} placeholder="Assign to…" className="w-full rounded border border-border bg-background pl-7 pr-2 py-1 text-[12px] outline-none" />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {(directory || []).filter((u) => !nq.trim() || u.name.toLowerCase().includes(nq.trim().toLowerCase())).slice(0, 8).map((u) => (
                  <button key={u.id} onClick={() => { onNudge(msg.id, u.id, nivl, nEsc); setNOpen(false); setNq(''); }}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] hover:bg-accent">
                    <ChatAvatar id={u.id} name={u.name} size={20} /><span className="truncate">{u.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/70">Pinged every {nivl < 60 ? `${nivl}m` : '1h'} until marked done.</p>
            </PopoverContent>
          </Popover>
          {TICKET_FROM_CHAT_ROLES.includes(meRole) && !msg.is_system && (
            <button onClick={() => onToTicket(msg)} className={`rounded p-1 hover:text-foreground ${msg.ticket ? 'text-sky-400' : 'text-muted-foreground'}`} title="Raise a ticket from this message"><TicketIcon className="h-3.5 w-3.5" /></button>
          )}
          {!msg.is_system && (
            <Popover open={aOpen} onOpenChange={(o) => { setAOpen(o); if (o) setASel(new Set(msg.ack?.required || [])); }}>
              <PopoverTrigger asChild>
                <button className={`rounded p-1 hover:text-foreground ${msg.ack ? 'text-emerald-400' : 'text-muted-foreground'}`} title="Request acknowledgement"><CheckCheck className="h-3.5 w-3.5" /></button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Request acknowledgement</p>
                <div className="relative mb-1">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <input value={aq} onChange={(e) => setAq(e.target.value)} placeholder="Who must acknowledge?" className="w-full rounded border border-border bg-background pl-7 pr-2 py-1 text-[12px] outline-none" />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {(directory || []).filter((u) => !aq.trim() || u.name.toLowerCase().includes(aq.trim().toLowerCase())).slice(0, 20).map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-accent">
                      <input type="checkbox" checked={aSel.has(u.id)} onChange={() => setASel((s) => { const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })} />
                      <ChatAvatar id={u.id} name={u.name} size={20} /><span className="truncate">{u.name}</span>
                    </label>
                  ))}
                </div>
                <button disabled={!aSel.size} onClick={() => { onRequestAck(msg.id, [...aSel]); setAOpen(false); setAq(''); }}
                  className="mt-1 w-full rounded bg-primary px-2 py-1 text-[12px] font-medium text-primary-foreground disabled:opacity-40">Request from {aSel.size || 0}</button>
              </PopoverContent>
            </Popover>
          )}
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
  const [pins, setPins] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', topic: '' });
  const [memberQ, setMemberQ] = useState('');
  const [ticketMsg, setTicketMsg] = useState(null);
  const [ticketForm, setTicketForm] = useState({ device_type: 'Inverter', issue_description: '', customer_name: '', customer_phone: '' });
  const [ticketBusy, setTicketBusy] = useState(false);
  const [schedAt, setSchedAt] = useState('');
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedList, setSchedList] = useState([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''], multi: false });
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const typingThrottle = useRef(0);

  const atBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length, activeId]);
  useEffect(() => { if (activeId) chat.fetchReads(activeId); /* eslint-disable-next-line */ }, [activeId]);

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
  const handleAction = async (id, confirm) => {
    try { await chat.resolveAction(id, confirm); }
    catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); }
  };
  const handleNudge = async (messageId, assigneeId, intervalMin, escalateAfter) => {
    try { const n = await chat.createNudge(messageId, assigneeId, intervalMin, escalateAfter); toast.success(`Follow-up set for ${n.assignee_name} · every ${n.interval_min}m${n.escalate_after ? ` · escalates after ${n.escalate_after}` : ''}`); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not set follow-up'); }
  };
  const handleResolveNudge = async (nudgeId) => {
    try { await chat.resolveNudge(nudgeId); toast.success('Follow-up marked done'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not close follow-up'); }
  };
  const openToTicket = (m) => {
    setTicketForm({ device_type: 'Inverter', issue_description: m.body || '', customer_name: '', customer_phone: '' });
    setTicketMsg(m);
  };
  const handleVote = async (messageId, optionId) => {
    try { await chat.votePoll(messageId, optionId); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not vote'); }
  };
  const handleClosePoll = async (messageId) => {
    try { await chat.closePoll(messageId); toast.success('Poll closed'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not close poll'); }
  };
  const submitPoll = async () => {
    const opts = pollForm.options.map((o) => o.trim()).filter(Boolean);
    if (!pollForm.question.trim() || opts.length < 2) { toast.error('Add a question and at least 2 options'); return; }
    try {
      await chat.createPoll(activeId, { question: pollForm.question, options: opts, multi: pollForm.multi });
      setPollOpen(false); setPollForm({ question: '', options: ['', ''], multi: false });
      toast.success('Poll posted');
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not create poll'); }
  };
  const handleRequestAck = async (messageId, userIds) => {
    try { const a = await chat.requestAck(messageId, userIds); toast.success(`Acknowledgement requested from ${(a.required || []).length}`); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not request acknowledgement'); }
  };
  const handleAck = async (messageId) => {
    try { await chat.acknowledge(messageId); toast.success('Acknowledged'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not acknowledge'); }
  };
  const handleSchedule = async () => {
    if (!text.trim()) { toast.error('Type a message first'); return; }
    if (!schedAt) { toast.error('Pick a date & time'); return; }
    const iso = new Date(schedAt).toISOString();
    if (new Date(iso) <= new Date()) { toast.error('Pick a future time'); return; }
    try {
      await chat.scheduleMessage(activeId, { body: text, deliver_at: iso });
      setText(''); setSchedAt(''); setSchedOpen(false);
      toast.success(`Scheduled for ${new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not schedule'); }
  };
  const submitToTicket = async () => {
    if (ticketBusy || !ticketMsg) return;
    if (!ticketForm.issue_description.trim()) { toast.error('Issue description required'); return; }
    setTicketBusy(true);
    try {
      const r = await chat.messageToTicket(ticketMsg.id, ticketForm);
      toast.success(`Ticket ${r.ticket_number} created`);
      setTicketMsg(null);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not create ticket'); }
    finally { setTicketBusy(false); }
  };

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
        <div className="ml-auto flex items-center gap-0.5">
          <Popover onOpenChange={(o) => o && chat.fetchPins(activeId).then(setPins)}>
            <PopoverTrigger asChild>
              <button className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Pinned messages"><Pin className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pinned</p>
              {pins.length === 0 ? <p className="py-3 text-center text-[12px] text-muted-foreground">No pinned messages.</p>
                : <div className="max-h-72 space-y-1 overflow-y-auto">{pins.map((p) => (
                    <div key={p.id} className="rounded border border-border/60 p-2 text-[12px]">
                      <span className="font-medium">{p.sender_name}</span>
                      <span className="ml-1 text-muted-foreground">{(p.body || '(attachment)').slice(0, 140)}</span>
                    </div>))}</div>}
            </PopoverContent>
          </Popover>
          <Popover onOpenChange={(o) => o && chat.fetchSaved().then(setSavedList)}>
            <PopoverTrigger asChild>
              <button className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Saved messages"><Bookmark className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saved</p>
              {savedList.length === 0 ? <p className="py-3 text-center text-[12px] text-muted-foreground">No saved messages.</p>
                : <div className="max-h-72 space-y-1 overflow-y-auto">{savedList.map((p) => (
                    <div key={p.id} className="rounded border border-border/60 p-2 text-[12px]">
                      <div className="text-[10px] text-muted-foreground">{p.sender_name} · #{p.channel_name}</div>
                      <span>{(p.body || '(attachment)').slice(0, 140)}</span>
                    </div>))}</div>}
            </PopoverContent>
          </Popover>
          <Popover onOpenChange={(o) => o && chat.fetchScheduled(activeId).then(setSchedList)}>
            <PopoverTrigger asChild>
              <button className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Scheduled messages"><Clock className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scheduled</p>
              {schedList.length === 0 ? <p className="py-3 text-center text-[12px] text-muted-foreground">Nothing scheduled here.</p>
                : <div className="max-h-72 space-y-1 overflow-y-auto">{schedList.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 rounded border border-border/60 p-2 text-[12px]">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-primary">{new Date(s.deliver_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="truncate text-muted-foreground">{s.body || '(attachment)'}</div>
                      </div>
                      <button onClick={async () => { try { await chat.cancelScheduled(s.id); setSchedList((l) => l.filter((x) => x.id !== s.id)); toast.success('Cancelled'); } catch { toast.error('Could not cancel'); } }}
                        className="rounded p-1 text-muted-foreground hover:text-rose-400" title="Cancel"><X className="h-3.5 w-3.5" /></button>
                    </div>))}</div>}
            </PopoverContent>
          </Popover>
          <button onClick={() => chat.muteChannel(activeId)} className={`rounded p-1.5 hover:text-foreground ${channel.muted ? 'text-amber-400' : 'text-muted-foreground'}`} title={channel.muted ? 'Unmute' : 'Mute'}>
            {channel.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>
          {channel.type !== 'dm' && CAN_EDIT_CHANNEL.includes(user.role) && (
            <button onClick={() => { setEditForm({ name: channel.name, topic: channel.topic || '', is_private: !!channel.is_private }); setEditOpen(true); }}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Edit channel"><Settings2 className="h-4 w-4" /></button>
          )}
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
              <MessageRow msg={m} prev={sep ? null : msgs[i - 1]} meId={user.id} meRole={user.role} onReact={chat.react} onEdit={startEdit} onDelete={chat.deleteMessage} onAction={handleAction} onPin={chat.pinMessage} onSave={chat.saveMessage} isSaved={chat.savedIds.has(m.id)} directory={directory} onNudge={handleNudge} onResolveNudge={handleResolveNudge} onToTicket={openToTicket} onRequestAck={handleRequestAck} onAck={handleAck} onVote={handleVote} onClosePoll={handleClosePoll} />
            </React.Fragment>
          );
        })}
        {(() => {
          const last = msgs[msgs.length - 1];
          if (!last) return null;
          const readers = Object.entries((chat.reads || {})[activeId] || {})
            .filter(([uid, info]) => uid !== user.id && uid !== last.sender_id && info.at && new Date(info.at) >= new Date(last.created_at))
            .map(([uid, info]) => ({ id: uid, name: info.name }));
          if (!readers.length) return null;
          return (
            <div className="flex items-center justify-end gap-1 px-3 pt-1 pb-2">
              <span className="text-[10px] text-muted-foreground">Seen by</span>
              {readers.slice(0, 5).map((r) => <ChatAvatar key={r.id} id={r.id} name={r.name} size={16} />)}
              {readers.length > 5 && <span className="text-[10px] text-muted-foreground">+{readers.length - 5}</span>}
            </div>
          );
        })()}
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
          <button onClick={() => setPollOpen(true)} className="rounded p-2 text-muted-foreground hover:text-foreground" title="Create a poll"><BarChart3 className="h-4 w-4" /></button>
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
          <Popover open={schedOpen} onOpenChange={setSchedOpen}>
            <PopoverTrigger asChild>
              <button className="rounded p-2 text-muted-foreground hover:text-foreground" title="Schedule send"><Clock className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Schedule send</p>
              <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)}
                className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-[12px] outline-none" />
              <button onClick={handleSchedule} disabled={!text.trim() || !schedAt}
                className="w-full rounded bg-primary px-2 py-1 text-[12px] font-medium text-primary-foreground disabled:opacity-40">Schedule</button>
              <p className="mt-1 text-[10px] text-muted-foreground/70">Sends your current message at the chosen time.</p>
            </PopoverContent>
          </Popover>
          <button onClick={send} disabled={!text.trim() && !pending.length}
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit channel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Channel name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="Topic" value={editForm.topic} onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })} />

            <label className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2">
              <span className="flex items-center gap-2">
                {editForm.is_private ? <Lock className="h-4 w-4 text-amber-400" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
                <span>
                  <span className="text-sm font-medium">{editForm.is_private ? 'Private channel' : 'Public channel'}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {editForm.is_private ? 'Only added members can see it' : 'Everyone on the team can see and join'}
                  </span>
                </span>
              </span>
              <input type="checkbox" checked={!!editForm.is_private}
                onChange={(e) => setEditForm({ ...editForm, is_private: e.target.checked })}
                className="h-4 w-4 accent-primary" />
            </label>

            {channel?.type !== 'dm' && !channel?.is_private && (
              <p className="text-[11px] text-muted-foreground">
                {editForm.is_private
                  ? 'Save to make this channel private, then add or remove members below.'
                  : 'Make this channel private to control exactly who’s a member.'}
              </p>
            )}

            {channel?.is_private && (() => {
              const memberIds = channel.members || [];
              const nameFor = (id) => (id === user.id ? 'You' : (directory.find((u) => u.id === id)?.name || 'Member'));
              const candidates = directory.filter((u) => !memberIds.includes(u.id)
                && (!memberQ.trim() || u.name.toLowerCase().includes(memberQ.trim().toLowerCase())));
              return (
                <div className="rounded-md border border-border p-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Members · {memberIds.length}</div>
                  <div className="mb-2 max-h-32 space-y-0.5 overflow-y-auto">
                    {memberIds.map((id) => (
                      <div key={id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[13px]">
                        <ChatAvatar id={id} name={nameFor(id)} size={20} />
                        <span className="truncate">{nameFor(id)}</span>
                        {id !== user.id && (
                          <button title="Remove" className="ml-auto text-muted-foreground hover:text-rose-400"
                            onClick={async () => { try { await chat.removeMember(activeId, id); } catch (e) { toast.error(e.response?.data?.detail || 'Could not remove'); } }}>
                            <X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Add people…" className="mb-1 h-8 text-[13px]" />
                  {memberQ.trim() && (
                    <div className="max-h-32 space-y-0.5 overflow-y-auto">
                      {candidates.map((u) => (
                        <button key={u.id} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-accent/60"
                          onClick={async () => { try { await chat.addMembers(activeId, [u.id]); setMemberQ(''); } catch (e) { toast.error(e.response?.data?.detail || 'Could not add'); } }}>
                          <ChatAvatar id={u.id} name={u.name} size={20} />
                          <span className="truncate">{u.name}</span>
                          <span className="ml-auto text-[10px] capitalize text-muted-foreground/60">{u.role?.replace('_', ' ')}</span>
                        </button>
                      ))}
                      {!candidates.length && <p className="px-1.5 py-1 text-[11px] text-muted-foreground/60">No matches.</p>}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              try {
                const wasPrivate = !!channel?.is_private;
                await chat.editChannel(activeId, { name: editForm.name, topic: editForm.topic, is_private: editForm.is_private });
                // If they just turned it private, keep the dialog open so the member
                // roster appears and they can add people right away.
                if (editForm.is_private && !wasPrivate) toast.success('Channel is now private — add members below');
                else setEditOpen(false);
              } catch (e) { toast.error(e.response?.data?.detail || 'Could not edit channel'); }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ticketMsg} onOpenChange={(o) => !o && setTicketMsg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise a ticket from this message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Device type</label>
              <select value={ticketForm.device_type} onChange={(e) => setTicketForm({ ...ticketForm, device_type: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none">
                {['Inverter', 'Battery', 'Stabilizer', 'Solar', 'Other'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Issue</label>
              <textarea value={ticketForm.issue_description} onChange={(e) => setTicketForm({ ...ticketForm, issue_description: e.target.value })} rows={3}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Customer name (optional)" value={ticketForm.customer_name} onChange={(e) => setTicketForm({ ...ticketForm, customer_name: e.target.value })} />
              <Input placeholder="Customer phone (optional)" value={ticketForm.customer_phone} onChange={(e) => setTicketForm({ ...ticketForm, customer_phone: e.target.value })} />
            </div>
            <p className="text-[11px] text-muted-foreground">Creates a new support ticket (status: new request) and links it back here.</p>
          </div>
          <DialogFooter>
            <Button onClick={submitToTicket} disabled={ticketBusy}>{ticketBusy ? 'Creating…' : 'Create ticket'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a poll</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Ask a question…" value={pollForm.question} onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })} />
            <div className="space-y-2">
              {pollForm.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setPollForm((f) => { const opts = [...f.options]; opts[i] = e.target.value; return { ...f, options: opts }; })} />
                  {pollForm.options.length > 2 && (
                    <button onClick={() => setPollForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-rose-400"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              {pollForm.options.length < 10 && (
                <button onClick={() => setPollForm((f) => ({ ...f, options: [...f.options, ''] }))} className="flex items-center gap-1 text-[12px] text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add option</button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={pollForm.multi} onChange={(e) => setPollForm({ ...pollForm, multi: e.target.checked })} />
              Allow multiple choices
            </label>
          </div>
          <DialogFooter>
            <Button onClick={submitPoll}>Post poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
