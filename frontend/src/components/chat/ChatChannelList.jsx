import React, { useState } from 'react';
import { useChat } from './ChatProvider';
import { ChatAvatar } from './chatUtils';
import { Hash, Lock, Plus, Search, BellOff, BellRing } from 'lucide-react';
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
  const [form, setForm] = useState({ name: '', topic: '', is_private: false, members: [] });
  const [memberQ, setMemberQ] = useState('');

  const toggleMember = (uid) => setForm((f) => ({
    ...f, members: f.members.includes(uid) ? f.members.filter((m) => m !== uid) : [...f.members, uid],
  }));

  const open = (id) => { chat.openChannel(id); onSelect && onSelect(); };
  const startDM = async (uid) => { const c = await chat.openDM(uid); onSelect && onSelect(); return c; };

  const groups = channels.filter((c) => c.type === 'channel');
  const dms = channels.filter((c) => c.type === 'dm');
  const ql = q.trim().toLowerCase();
  const dmUserIds = new Set(dms.map((d) => d.dm_user?.id));
  const people = directory.filter((u) => !dmUserIds.has(u.id) && (!ql || u.name.toLowerCase().includes(ql)));

  const create = async () => {
    if (!form.name.trim()) return;
    try {
      const payload = { ...form, members: form.is_private ? form.members : [] };
      const c = await chat.createChannel(payload);
      setShowNew(false); setForm({ name: '', topic: '', is_private: false, members: [] }); setMemberQ('');
      chat.openChannel(c.id); onSelect && onSelect();
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not create channel'); }
  };

  const Item = ({ id, icon, label, unread, active, muted }) => (
    <button onClick={() => open(id)}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${active ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'} ${muted ? 'opacity-50' : ''}`}>
      {icon} <span className="truncate">{label}</span>
      {muted ? <BellOff className="ml-auto h-3 w-3 flex-shrink-0" /> : <Unread n={unread} />}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people…" className="h-8 pl-8 text-[13px]" />
          </div>
          <button
            onClick={chat.toggleSound}
            title={chat.soundEnabled
              ? 'New-message sounds on — click to mute pings'
              : 'New-message sounds off — click to enable pings'}
            className={`flex-shrink-0 rounded p-1.5 transition hover:text-foreground ${chat.soundEnabled ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {chat.soundEnabled ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
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
            <Item key={c.id} id={c.id} active={c.id === activeId} unread={c.unread} muted={c.muted}
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
              <span className="truncate">{c.name}</span>{c.muted ? <BellOff className="ml-auto h-3 w-3" /> : <Unread n={c.unread} />}
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
            {form.is_private && (
              <div className="rounded-md border border-border p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Members</span>
                  <span className="text-[11px] text-muted-foreground">{form.members.length} selected</span>
                </div>
                <Input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Search people…" className="mb-2 h-8 text-[13px]" />
                <div className="max-h-44 space-y-0.5 overflow-y-auto">
                  {directory.filter((u) => !memberQ.trim() || u.name.toLowerCase().includes(memberQ.trim().toLowerCase())).map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-accent/60">
                      <input type="checkbox" checked={form.members.includes(u.id)} onChange={() => toggleMember(u.id)} />
                      <ChatAvatar id={u.id} name={u.name} size={20} />
                      <span className="truncate">{u.name}</span>
                      <span className="ml-auto text-[10px] capitalize text-muted-foreground/60">{u.role?.replace('_', ' ')}</span>
                    </label>
                  ))}
                  {!directory.length && <p className="px-1.5 py-2 text-[11px] text-muted-foreground/60">No one else available.</p>}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/70">You're added automatically. Public channels are open to everyone — make it private to pick members.</p>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
