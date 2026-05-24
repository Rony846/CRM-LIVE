import React, { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * SerialSheet — spreadsheet-like serial-number entry for production completion.
 *
 * Features:
 *   • Bulk paste from Excel / Notepad (split on whitespace, comma, tab, newline)
 *   • Auto-detects the most common prefix + numeric range → "sequence"
 *   • Flags GAPS in the sequence (highlight + one-click "fill missing rows")
 *   • Flags RANDOM entries that don't share the dominant prefix
 *   • Flags DUPLICATE serial numbers
 *   • Flags EMPTY rows
 *
 * Data contract — unchanged from the legacy row-by-row form:
 *   value:    [{ serial_number: string, notes: string }]
 *   onChange: (rows) => void
 */

// "MG2604128" → { prefix: "MG2604", num: 128, digitCount: 3 }
function parseSerial(s) {
  const t = String(s || '').trim();
  if (!t) return { prefix: null, num: null, digitCount: 0 };
  // Tail run of digits is the sequence number; everything before is the prefix.
  const m = t.match(/^(.*?)(\d+)$/);
  if (!m) return { prefix: t, num: null, digitCount: 0 };
  return { prefix: m[1], num: parseInt(m[2], 10), digitCount: m[2].length };
}

function fmtSerial(prefix, num, digitCount) {
  return prefix + String(num).padStart(digitCount || 0, '0');
}

// Returns { prefix, min, max, digitCount, present: Set<number> } or null.
function detectSequence(rows) {
  const parsed = rows
    .map((r) => parseSerial(r.serial_number))
    .filter((p) => p.prefix !== null && p.num !== null);
  if (parsed.length < 2) return null;

  // The "main" prefix is whichever appears the most.
  const counts = {};
  parsed.forEach((p) => {
    counts[p.prefix] = (counts[p.prefix] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [mainPrefix, mainCount] = sorted[0];
  if (mainCount < 2) return null;

  const inSeries = parsed.filter((p) => p.prefix === mainPrefix);
  const nums = inSeries.map((p) => p.num);
  return {
    prefix: mainPrefix,
    min: Math.min(...nums),
    max: Math.max(...nums),
    digitCount: inSeries[0].digitCount,
    present: new Set(nums),
  };
}

export default function SerialSheet({ value, onChange, expectedQty, scrapTotal = 0 }) {
  const rows = value || [];
  const [bulkPaste, setBulkPaste] = useState('');

  const sequence = useMemo(() => detectSequence(rows), [rows]);
  const gaps = useMemo(() => {
    if (!sequence) return [];
    const out = [];
    for (let n = sequence.min; n <= sequence.max; n++) {
      if (!sequence.present.has(n)) out.push(fmtSerial(sequence.prefix, n, sequence.digitCount));
    }
    return out;
  }, [sequence]);

  // Per-row classification — used for highlighting.
  const rowStatus = useMemo(() => {
    const seen = new Set();
    return rows.map((r) => {
      const sn = (r.serial_number || '').trim();
      if (!sn) return 'empty';
      if (seen.has(sn)) return 'duplicate';
      seen.add(sn);
      if (!sequence) return 'sequence';
      const p = parseSerial(sn);
      if (p.prefix === sequence.prefix && p.num != null) return 'sequence';
      return 'random';
    });
  }, [rows, sequence]);

  const addRow = () => onChange([...rows, { serial_number: '', notes: '' }]);
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));
  const updateRow = (idx, field, val) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  // Replace the entire list with pasted serials (whitespace/comma/tab-separated).
  const applyBulkPaste = () => {
    const tokens = bulkPaste
      .split(/[\s,\t\n\r;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    onChange(tokens.map((t) => ({ serial_number: t, notes: '' })));
    setBulkPaste('');
  };

  // Insert empty (well — pre-filled placeholder) rows for the detected gaps so
  // the supervisor can confirm them or add notes.
  const fillMissing = () => {
    if (!gaps.length) return;
    onChange([
      ...rows,
      ...gaps.map((g) => ({ serial_number: g, notes: '(was missing from sequence — please verify)' })),
    ]);
  };

  const randomCount = rowStatus.filter((s) => s === 'random').length;
  const dupCount = rowStatus.filter((s) => s === 'duplicate').length;
  const emptyCount = rowStatus.filter((s) => s === 'empty').length;
  const filledCount = rows.length - emptyCount;
  const target = (expectedQty || 0) - (scrapTotal || 0);

  return (
    <div className="space-y-3">
      {/* Bulk paste — collapsed by default */}
      <details className="rounded-lg border border-slate-600 bg-slate-700/30 open:bg-slate-700/40">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-300">
          <Upload className="mr-2 inline h-3.5 w-3.5" />
          Bulk paste from Excel / Notepad
        </summary>
        <div className="border-t border-slate-600 p-3">
          <textarea
            value={bulkPaste}
            onChange={(e) => setBulkPaste(e.target.value)}
            placeholder="Paste serial numbers — one per line (or comma / tab / space-separated). The whole list will be replaced."
            rows={4}
            className="w-full font-mono text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setBulkPaste('')} disabled={!bulkPaste}>
              Clear
            </Button>
            <Button size="sm" onClick={applyBulkPaste} disabled={!bulkPaste.trim()}>
              <Check className="mr-1 h-3.5 w-3.5" />
              Replace list with {bulkPaste.split(/[\s,\t\n\r;]+/).filter(Boolean).length || 0} serials
            </Button>
          </div>
        </div>
      </details>

      {/* Sequence summary banner */}
      {sequence ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="text-sm">
            <span className="text-slate-400">Sequence detected: </span>
            <span className="font-mono text-cyan-300">
              {fmtSerial(sequence.prefix, sequence.min, sequence.digitCount)}
              <span className="text-slate-500"> → </span>
              {fmtSerial(sequence.prefix, sequence.max, sequence.digitCount)}
            </span>
            <span className="ml-2 text-slate-400">
              · {sequence.max - sequence.min + 1} expected · {sequence.present.size} entered ·{' '}
              {gaps.length ? (
                <span className="text-amber-400">{gaps.length} missing</span>
              ) : (
                <span className="text-emerald-400">no gaps ✓</span>
              )}
              {randomCount > 0 && (
                <>
                  {' '}
                  · <span className="text-rose-400">{randomCount} random</span>
                </>
              )}
              {dupCount > 0 && (
                <>
                  {' '}
                  · <span className="text-rose-400">{dupCount} duplicate</span>
                </>
              )}
            </span>
          </div>
          {gaps.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={fillMissing}
              className="border-amber-500 text-amber-300 hover:bg-amber-500/20"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add {gaps.length} missing row{gaps.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      ) : (
        rows.length > 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
            Enter at least two serial numbers sharing a common prefix to enable sequence-gap detection.
          </div>
        )
      )}

      {/* Spreadsheet table */}
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-800">
              <tr>
                <th className="w-12 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Serial Number</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</th>
                <th className="w-32 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                    No serial numbers yet. Use <span className="text-cyan-400">Add row</span> below, or paste a list above.
                  </td>
                </tr>
              )}
              {rows.map((r, idx) => {
                const status = rowStatus[idx];
                const rowClass = {
                  random: 'bg-rose-500/[0.08] border-l-2 border-rose-500',
                  duplicate: 'bg-rose-500/[0.08] border-l-2 border-rose-500',
                  empty: 'bg-amber-500/[0.06] border-l-2 border-amber-500',
                  sequence: 'border-l-2 border-transparent',
                }[status];
                return (
                  <tr key={idx} className={`border-t border-slate-700/40 transition-colors ${rowClass}`}>
                    <td className="px-3 py-1.5 align-middle font-mono text-xs text-slate-500">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <Input
                        value={r.serial_number}
                        onChange={(e) => updateRow(idx, 'serial_number', e.target.value)}
                        placeholder="Enter serial number"
                        className="h-8 border-slate-600 bg-slate-700 font-mono text-sm text-white"
                        data-testid={`sheet-serial-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <Input
                        value={r.notes || ''}
                        onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="h-8 border-slate-600 bg-slate-700 text-sm text-white"
                      />
                    </td>
                    <td className="px-3 py-1.5 align-middle text-xs">
                      {status === 'sequence' && (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <Check className="h-3 w-3" />
                          in sequence
                        </span>
                      )}
                      {status === 'random' && (
                        <span className="inline-flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="h-3 w-3" />
                          random
                        </span>
                      )}
                      {status === 'duplicate' && (
                        <span className="inline-flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="h-3 w-3" />
                          duplicate
                        </span>
                      )}
                      {status === 'empty' && (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          empty
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(idx)}
                        title="Remove row"
                        className="h-7 w-7 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-800/40">
              <tr>
                <td colSpan={5} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button size="sm" variant="ghost" onClick={addRow} className="h-7 text-cyan-400">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add row
                    </Button>
                    <span className="text-xs text-slate-400">
                      <span className="text-white">{filledCount}</span> filled
                      {expectedQty != null && (
                        <>
                          {' '}
                          / <span className="text-white">{target}</span> good units needed
                        </>
                      )}
                      {emptyCount > 0 && <span className="ml-3 text-amber-400">· {emptyCount} empty row{emptyCount === 1 ? '' : 's'}</span>}
                      {randomCount > 0 && <span className="ml-3 text-rose-400">· {randomCount} random</span>}
                      {dupCount > 0 && <span className="ml-3 text-rose-400">· {dupCount} duplicate</span>}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
