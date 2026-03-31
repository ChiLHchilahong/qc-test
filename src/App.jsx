import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './auth/AuthContext';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import VersionDetail from './pages/VersionDetail';
import BuildChecklist from './pages/BuildChecklist';
import TestPlans from './pages/TestPlans';
import TestPlanDetail from './pages/TestPlanDetail';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Bugs from './pages/Bugs';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route
                path="/projects/:projectId/versions/:versionId"
                element={<VersionDetail />}
              />
              <Route
                path="/projects/:projectId/versions/:versionId/builds/:buildId"
                element={<BuildChecklist />}
              />
              <Route path="/test-plans" element={<TestPlans />} />
              <Route path="/test-plans/:planId" element={<TestPlanDetail />} />
              <Route path="/bugs" element={<Bugs />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
