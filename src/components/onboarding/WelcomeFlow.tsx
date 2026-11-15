'use client';

import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { TopicKey } from '@/lib/topicConfig';
import { Dialog, DialogPortal } from '@/components/ui/dialog';
import { SectorStep } from './SectorStep';
import { TechnologyStep } from './TechnologyStep';

export type WelcomeStep = 'sector' | 'technology';

interface WelcomeFlowProps {
  initialStep: WelcomeStep;
  initialTopic: TopicKey;
  lastTechnologyId: string | null;
  /** Closing without a choice (skip link, Esc). */
  onSkip: () => void;
  onChooseTechnology: (topic: TopicKey, technologyId: string) => void;
}

/**
 * Full-screen first-run flow: pick a sector, then a deployment concept to
 * follow. Mount it to open; unmount it to close.
 */
export function WelcomeFlow({
  initialStep,
  initialTopic,
  lastTechnologyId,
  onSkip,
  onChooseTechnology,
}: WelcomeFlowProps) {
  const [step, setStep] = useState<WelcomeStep>(initialStep);
  const [sector, setSector] = useState<TopicKey>(initialTopic);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onSkip();
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Content className="fixed inset-0 z-[80] overflow-y-auto bg-gradient-to-b from-slate-200/90 via-slate-100/80 to-white/70 backdrop-blur-sm duration-300 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0">
          {step === 'sector' ? (
            <SectorStep
              currentTopic={sector}
              onSkip={onSkip}
              onSelectSector={(topic) => {
                setSector(topic);
                setStep('technology');
              }}
            />
          ) : (
            <TechnologyStep
              key={sector}
              topic={sector}
              lastTechnologyId={lastTechnologyId}
              onBack={() => setStep('sector')}
              onSkip={onSkip}
              onSelectTechnology={(technologyId) =>
                onChooseTechnology(sector, technologyId)
              }
            />
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
