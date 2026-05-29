import React, { useState } from 'react';
import { useChat } from './ChatProvider';
import { ChatAvatar } from './chatUtils';
import { Hash, Lock, Plus, Search, ChevronDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CAN_CREATE = ['admin', 'supervisor'];

function Unread({ n }) {
  if (!n) return null;
  return <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{n > 99 ? '99+' : n}</span>;
}

export default function ChatChannelList({ onSelect }) {
  const chat = useChat();
  const { channels, directory, activeId, user } = chat;
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', topic: '', is_private: false });

  const open = (id) => { chat.openChannel(id); onSelect && onSelect(); };
  const startDM = async (uid) => { const c = await chat.openDM(uid); onSelect && onSelect(); return c; };

  const groups = channels.filter((c) => c.type === 'channel');
  const dms = channels.filter((c) => c.type === 'dm');
  const ql = q.trim().toLowerCase();
  const dmUserIds = new Set(dms.map((d) => d.dm_user?.id));
  const people = directory.filter((u) => !dmUserIds.has(u.id) && (!ql || u.name.toLowerCase().includes(ql)));

  const create = async () => {
    if (!form.name.trim()) return;
    try { const c = await chat.createChannel(form); setShowNew(false); setForm({ name: '', topic: '', is_private: false }); chat.openChannel(c.id); onSelect && onSelect(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not create channel'); }
  };

  const Item = ({ id, icon, label, online, unread, active }) => (
    <button onClick={() => open(id)}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${active ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}>
      {icon} <span className="truncate">{label}</span> <Unread n={unread} />
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people…" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</span>
            {CAN_CREATE.includes(user.role) && (
              <button onClick={() => setShowNew(true)} className="text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
            )}
          </div>
          {groups.map((c) => (
            <Item key={c.id} id={c.id} active={c.id === activeId} unread={c.unread}
              icon={c.is_private ? <Lock className="h-3.5 w-3.5 flex-shrink-0" /> : <Hash className="h-3.5 w-3.5 flex-shrink-0" />}
              label={c.name} />
          ))}
        </div>

        <div>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Direct Messages</div>
          {dms.map((c) => (
            <button key={c.id} onClick={() => open(c.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${c.id === activeId ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}>
              <ChatAvatar id={c.dm_user?.id} name={c.name} online={c.dm_user?.online} size={22} />
              <span className="truncate">{c.name}</span><Unread n={c.unread} />
            </button>
          ))}
          {!dms.length && <p className="px-2 text-[11px] text-muted-foreground/60">Start a DM from People below.</p>}
        </div>

        <div>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">People</div>
          {people.map((u) => (
            <button key={u.id} onClick={() => startDM(u.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent/60 hover:text-foreground">
              <ChatAvatar id={u.id} name={u.name} online={u.online} size={22} />
              <span className="truncate">{u.name}</span>
              <span className="ml-auto text-[10px] capitalize text-muted-foreground/60">{u.role?.replace('_', ' ')}</span>
            </button>
          ))}
          {!people.length && <p className="px-2 text-[11px] text-muted-foreground/60">No one else found.</p>}
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create channel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Channel name (e.g. marketing)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Topic (optional)" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} />
              Private (invite-only)
            </label>
          </div>
          <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
