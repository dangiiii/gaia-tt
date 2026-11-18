import { Atom, Boxes, Flame, type LucideIcon } from 'lucide-react';
import { TopicKey } from '@/lib/topicConfig';

export interface SectorCopy {
  icon: LucideIcon;
  tagline: string;
  /** Noun used in "Which … do you want to follow?". */
  pickerNoun: string;
}

export const SECTOR_COPY: Record<TopicKey, SectorCopy> = {
  nuclear: {
    icon: Atom,
    tagline:
      'Fission and fusion reactor concepts, from tokamaks to molten salt reactors.',
    pickerNoun: 'reactor concept',
  },
  smr: {
    icon: Boxes,
    tagline:
      'Small modular reactor and microreactor designs from the IAEA and NEA catalogues.',
    pickerNoun: 'reactor design',
  },
  fossil_fuels: {
    icon: Flame,
    tagline:
      'Coal, gas and oil plant pathways, including co-firing and advanced cycles.',
    pickerNoun: 'plant pathway',
  },
};

export const SECTOR_ORDER: TopicKey[] = ['nuclear', 'smr', 'fossil_fuels'];
