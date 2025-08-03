// App.tsx - Main app setup
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NotificationProvider } from './components/NotificationProvider';
import ProcessMaker from './components/ProcessMaker';

function App() {
  return (
    <NotificationProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/workflow/process-maker" element={<ProcessMaker />} />
            <Route path="/workflow/process-maker/:processId" element={<ProcessMaker />} />
            {/* Add other routes here */}
          </Routes>
        </div>
      </Router>
    </NotificationProvider>
  );
}

export default App;