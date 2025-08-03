import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, Save, Edit, Plus } from 'lucide-react';

// Main conversion guide component
const BPMNReactConverter = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Search },
    { id: 'structure', label: 'Project Structure', icon: Edit },
    { id: 'components', label: 'Components', icon: Plus },
    { id: 'migration', label: 'Migration Steps', icon: Download }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Angular to React BPMN Migration Guide
            </h1>
          </div>
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-3 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'structure' && <StructureTab />}
        {activeTab === 'components' && <ComponentsTab />}
        {activeTab === 'migration' && <MigrationTab />}
      </div>
    </div>
  );
};

// Overview Tab
const OverviewTab = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Migration Overview</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Current Angular Stack</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Angular Components & Services</li>
            <li>• BPMN-JS with Camunda extensions</li>
            <li>• PrimeNG UI components</li>
            <li>• RxJS for async operations</li>
            <li>• TypeScript</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Target React Stack</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• React functional components + hooks</li>
            <li>• BPMN-JS (same core library)</li>
            <li>• Tailwind CSS + Headless UI</li>
            <li>• React Query for data fetching</li>
            <li>• TypeScript</li>
          </ul>
        </div>
      </div>
    </div>

    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-medium text-blue-900 mb-2">Key Benefits</h3>
      <ul className="text-sm text-blue-800 space-y-1">
        <li>• Simplified state management with React hooks</li>
        <li>• Better performance with React's reconciliation</li>
        <li>• Larger ecosystem and community</li>
        <li>• More flexible component composition</li>
      </ul>
    </div>
  </div>
);

// Project Structure Tab
const StructureTab = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Recommended Project Structure</h2>
      <div className="bg-gray-50 rounded-md p-4 font-mono text-sm">
        <pre>{`src/
├── components/
│   ├── bpmn/
│   │   ├── ProcessMaker.tsx
│   │   ├── PropertiesPanel.tsx
│   │   └── ConfirmOutputs.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx
│   │   └── Input.tsx
│   └── forms/
├── hooks/
│   ├── useBPMN.ts
│   ├── useAPI.ts
│   └── useProcesses.ts
├── services/
│   ├── api.ts
│   ├── bpmn.ts
│   └── auth.ts
├── types/
│   ├── bpmn.ts
│   ├── process.ts
│   └── api.ts
├── utils/
│   ├── bpmn-extensions/
│   │   ├── custom-providers/
│   │   ├── custom-properties/
│   │   └── descriptors/
│   └── helpers.ts
└── App.tsx`}</pre>
      </div>
    </div>
  </div>
);

// Components Tab
const ComponentsTab = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Key Component Conversions</h2>
      
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">1. ProcessMaker Component</h3>
          <div className="bg-gray-50 rounded p-3 text-sm">
            <strong>Angular:</strong> Class component with lifecycle hooks<br/>
            <strong>React:</strong> Functional component with useEffect and useRef
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">2. Custom BPMN Providers</h3>
          <div className="bg-gray-50 rounded p-3 text-sm">
            <strong>Keep:</strong> BPMN-JS providers remain the same<br/>
            <strong>Integration:</strong> Initialize in useEffect hook
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">3. Properties Panel</h3>
          <div className="bg-gray-50 rounded p-3 text-sm">
            <strong>Angular:</strong> Template-driven with two-way binding<br/>
            <strong>React:</strong> Controlled components with state management
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">4. API Services</h3>
          <div className="bg-gray-50 rounded p-3 text-sm">
            <strong>Angular:</strong> Injectable services with HttpClient<br/>
            <strong>React:</strong> Custom hooks with fetch/axios + React Query
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Migration Steps Tab
const MigrationTab = () => {
  const [completedSteps, setCompletedSteps] = useState(new Set());
  
  const steps = [
    { id: 1, title: "Setup React Project", description: "Create new React app with TypeScript" },
    { id: 2, title: "Install Dependencies", description: "Add BPMN-JS, Tailwind, React Query" },
    { id: 3, title: "Convert BPMN Extensions", description: "Port custom providers and descriptors" },
    { id: 4, title: "Create Base Components", description: "Convert Angular components to React" },
    { id: 5, title: "Implement Hooks", description: "Replace services with custom hooks" },
    { id: 6, title: "Setup Routing", description: "Configure React Router" },
    { id: 7, title: "Style Migration", description: "Convert to Tailwind CSS" },
    { id: 8, title: "Testing", description: "Add tests and validate functionality" }
  ];

  const toggleStep = (stepId) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Migration Checklist</h2>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start space-x-3">
              <button
                onClick={() => toggleStep(step.id)}
                className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                  completedSteps.has(step.id)
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {completedSteps.has(step.id) && '✓'}
              </button>
              <div className="flex-1">
                <h3 className={`font-medium ${
                  completedSteps.has(step.id) ? 'line-through text-gray-500' : 'text-gray-900'
                }`}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Progress</span>
            <span className="text-sm text-gray-600">
              {completedSteps.size} of {steps.length} completed
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps.size / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-900 mb-2">Important Notes</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Keep BPMN-JS extensions unchanged - they work with React</li>
          <li>• Test custom providers thoroughly after migration</li>
          <li>• Consider using React Query for better data fetching</li>
          <li>• Migrate incrementally, component by component</li>
        </ul>
      </div>
    </div>
  );
};

export default BPMNReactConverter;