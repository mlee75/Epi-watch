'use client';

import { useState } from 'react';
import Globe3D from './Globe3D';
import { OutbreakDetailPanel } from './OutbreakDetailPanel';
import type { Outbreak } from '@/lib/types';

interface Props {
  outbreaks: Outbreak[];
}

export default function GlobeScene({ outbreaks }: Props) {
  const [selected, setSelected] = useState<Outbreak | null>(null);

  return (
    <>
      <Globe3D outbreaks={outbreaks} onSelect={setSelected} />
      <OutbreakDetailPanel outbreak={selected} onClose={() => setSelected(null)} />
    </>
  );
}
