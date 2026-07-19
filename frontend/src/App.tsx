import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { RegisterPage } from './features/auth/RegisterPage';
import { LoginPage } from './features/auth/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { ExercisesPage } from './pages/ExercisesPage';
import WorkoutPlansPage from './pages/WorkoutPlansPage';
import WorkoutPlanDetailPage from './pages/WorkoutPlanDetailPage';
import ActiveWorkoutPage from './pages/ActiveWorkoutPage';
import { WorkoutHistoryPage } from './pages/WorkoutHistoryPage';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import './App.css';

function App() {
  return (
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
            path="/workout-plans/:planId"
            element={
              <ProtectedRoute>
                <WorkoutPlanDetailPage />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
