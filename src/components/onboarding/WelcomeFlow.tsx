'use client';

import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { TopicKey } from '@/lib/topicConfig';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
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
 * First-run chooser: a floating glass sheet over the live map so the user
 * picks a small set of options, then follows a guided pathway.
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
        <DialogOverlay className="z-[80] bg-slate-900/20 backdrop-blur-[3px]" />
        <DialogPrimitive.Content className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-6 focus:outline-none">
          <div className="glass-sheet animate-sheet-in my-auto w-full max-w-xl overflow-hidden sm:max-w-2xl">
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
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
