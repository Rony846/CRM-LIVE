import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TicketSearchBar from '@/components/TicketSearchBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChartArea, RefreshCw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { CountUp, Shimmer } from '@/components/ui/motion';

const CRITERIA = [
  { key: 'greeting', label: 'Greeting' },
  { key: 'empathy', label: 'Empathy' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'handoff', label: 'Handoff' },
  { key: 'close', label: 'Close' },
];

const scoreTone = (n) => {
  if (n == null) return 'text-slate-400';
  if (n >= 4.5) return 'text-emerald-600';
  if (n >= 3.5) return 'text-blue-600';
  if (n >= 2.5) return 'text-amber-600';
  return 'text-rose-600';
};

export default function QAScorecards() {
  const { token } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/smartflo/qa/agent-scorecards`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { days },
      });
      setData(r.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  const agents = data?.agents || [];

  return (
    <DashboardLayout title="QA Scorecards">
      <TicketSearchBar />
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-slate-500">
            Per-agent 5-criteria call-quality averages over the selected window. Calls must have a transcript + scorecard to appear.
          </p>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7d</SelectItem>
                <SelectItem value="30">Last 30d</SelectItem>
                <SelectItem value="90">Last 90d</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-48" />)}
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <ChartArea className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>No QA scorecards yet for this window.</p>
              <p className="text-xs mt-2">
                Run <code>POST /api/smartflo/calls/{'{id}'}/qa-score</code> on calls with transcripts to populate.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((a, idx) => (
              <motion.div
                key={a.agent_name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(idx, 10) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-800">{a.agent_name}</h3>
                      <p className="text-xs text-slate-500">
                        <CountUp value={a.calls_scored || 0} /> call{a.calls_scored === 1 ? '' : 's'} scored
                      </p>
                    </div>
                    <CountUp
                      value={a.averages?.overall ?? 0}
                      decimals={1}
                      className={`text-2xl font-semibold ${scoreTone(a.averages?.overall)}`}
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    {CRITERIA.map((c) => (
                      <div key={c.key} className="bg-slate-50 rounded p-2">
                        <p className="text-[10px] uppercase text-slate-500">{c.label}</p>
                        <p className={`text-sm font-semibold ${scoreTone(a.averages?.[c.key])}`}>
                          {(a.averages?.[c.key] ?? 0).toFixed(1)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {a.weakest_criterion && (
                    <div className="text-xs">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                        Weakest: {a.weakest_criterion}
                      </Badge>
                    </div>
                  )}

                  {a.latest_coaching?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Coaching tips
                      </p>
                      {a.latest_coaching.map((t, i) => (
                        <p key={i} className="text-xs text-slate-700 italic">"{t.tip}"</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
