import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { RegisterPage } from './features/auth/RegisterPage';
import { LoginPage } from './features/auth/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { ExercisesPage } from './pages/ExercisesPage';
import WorkoutPlansPage from './pages/WorkoutPlansPage';
import CreatePlanPage from './pages/CreatePlanPage';
import EditPlanPage from './pages/EditPlanPage';
import SessionSetupPage from './pages/SessionSetupPage';
import ActiveWorkoutPage from './pages/ActiveWorkoutPage';
import { WorkoutHistoryPage } from './pages/WorkoutHistoryPage';
import SessionDetailPage from './pages/SessionDetailPage';
import ExerciseProgressPage from './pages/ExerciseProgressPage';
import { AuthProvider } from './features/auth/AuthContext';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import './App.css';

function App() {
  return (
    <UnsavedChangesProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <ExercisesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-plans"
            element={
              <ProtectedRoute>
                <WorkoutPlansPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-plans/new"
            element={
              <ProtectedRoute>
                <CreatePlanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-plans/:planId/edit"
            element={
              <ProtectedRoute>
                <EditPlanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-plans/:planId/start"
            element={
              <ProtectedRoute>
                <SessionSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-sessions/:sessionId"
            element={
              <ProtectedRoute>
                <ActiveWorkoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-history"
            element={
              <ProtectedRoute>
                <WorkoutHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout-history/:sessionId"
            element={
              <ProtectedRoute>
                <SessionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises/:exerciseId/progress"
            element={
              <ProtectedRoute>
                <ExerciseProgressPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </UnsavedChangesProvider>
  );
}

export default App;
