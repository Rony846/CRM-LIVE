import React, { useState } from 'react';
import IronShell from '@/components/iron/IronShell';
import { T } from '@/components/iron/IronKit';
import AmazonRefunds from './AmazonRefundsIron';
import AmazonRefundLosses from './AmazonRefundLossesIron';
import RefundRecovery from './RefundRecovery';

const TABS = [
  { key: 'refunds', label: 'Amazon Refunds', el: AmazonRefunds },
  { key: 'losses', label: 'Refund Losses', el: AmazonRefundLosses },
  { key: 'recovery', label: 'Refund Recovery', el: RefundRecovery },
];

// One page, three tabs — merges the former Amazon Refunds / Refund Losses / Refund Recovery
// nav items. Each sub-page renders in `embedded` mode (skips its own shell) so there's one shell.
export default function RefundsHub() {
  const init = new URLSearchParams(window.location.search).get('tab');
  const [tab, setTab] = useState(TABS.some((t) => t.key === init) ? init : 'refunds');
  const Active = TABS.find((t) => t.key === tab).el;
  return (
    <IronShell title="Refunds" subtitle="AMAZON REFUNDS · LOSSES · RECOVERY">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: `1px solid ${T.iron200}`, paddingBottom: 2 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '9px 16px', fontFamily: T.headline, fontWeight: 800, fontSize: 13,
              color: tab === t.key ? T.orange : T.iron500,
              borderBottom: `2px solid ${tab === t.key ? T.orange : 'transparent'}`,
            }}>{t.label}</button>
        ))}
      </div>
      <Active embedded />
    </IronShell>
  );
}
