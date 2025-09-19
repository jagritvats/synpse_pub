import React from 'react';
import { IntegrationsCombined } from '@/components/settings/integrations-combined';

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Integrations</h3>
        <p className="text-sm text-gray-500">
          Connect Synapse to external services to enhance its capabilities and expand your workspace.
        </p>
      </div>
      <IntegrationsCombined />
    </div>
  );
}
