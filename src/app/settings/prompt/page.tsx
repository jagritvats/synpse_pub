import React from 'react';
import { CompanionConfigForm } from '@/components/settings/companion-config-form';

export default function CompanionConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Companion Configuration</h3>
        <p className="text-sm text-gray-500">
          Customize how Synapse responds to you and set specific goals for your AI companion to focus on.
        </p>
      </div>
      <CompanionConfigForm />
    </div>
  );
}
