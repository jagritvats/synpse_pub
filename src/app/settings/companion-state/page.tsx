import React from 'react';
import { InterestsAndCompanionView } from '@/components/settings/companion-internal-state-view';

export default function CompanionStatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Companion Internal State</h3>
        <p className="text-sm text-gray-500">
          Explore your AI companion's internal state to understand how it adapts to your interactions.
        </p>
      </div>
      <InterestsAndCompanionView />
    </div>
  );
} 