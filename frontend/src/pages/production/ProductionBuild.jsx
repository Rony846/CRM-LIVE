import React from 'react';
import IronShell from '@/components/iron/IronShell';
import ProductionBuildPanel from '@/components/ProductionBuildPanel';

/* Standalone Build Unit page. The same panel also opens as a popup on Ship Desk
   (build + pack happen at the same station). */
export default function ProductionBuild() {
  return (
    <IronShell title="Production — build units" subtitle="Scan components → serial is minted, linked & printed">
      <ProductionBuildPanel />
    </IronShell>
  );
}
