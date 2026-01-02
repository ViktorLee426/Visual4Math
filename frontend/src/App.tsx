import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import TopHeader from "./components/TopHeader";
import WelcomePage from "./pages/WelcomePage";
import { TaskTimerProvider } from "./contexts/TaskTimerContext";
import ProtectedRoute from "./components/ProtectedRoute";

const InstructionsPage = lazy(() => import("./pages/InstructionsPage"));
const Tool1IntroPage = lazy(() => import("./pages/Tool1IntroPage"));
const Tool1ChatPage = lazy(() => import("./pages/Tool1ChatPage"));
const Tool1EvalPage = lazy(() => import("./pages/Tool1EvalPage"));
const Tool2IntroPage = lazy(() => import("./pages/Tool2IntroPage"));
const Tool2LayoutPage = lazy(() => import("./pages/Tool2LayoutPage"));
const Tool2EvalPage = lazy(() => import("./pages/Tool2EvalPage"));
const Tool3IntroPage = lazy(() => import("./pages/Tool3IntroPage"));
const Tool3PanelPage = lazy(() => import("./pages/Tool3PanelPage"));
const Tool3EvalPage = lazy(() => import("./pages/Tool3EvalPage"));
const FinalSurveyPage = lazy(() => import("./pages/FinalSurveyPage"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-gray-600">Loading...</div>
  </div>
);

function App() {
  return (
    <TaskTimerProvider>
      <Router>
        <TopHeader />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/instructions" element={<ProtectedRoute><InstructionsPage /></ProtectedRoute>} />
            <Route path="/tool1-intro" element={<ProtectedRoute><Tool1IntroPage /></ProtectedRoute>} />
            <Route path="/tool1" element={<ProtectedRoute><Tool1ChatPage /></ProtectedRoute>} />
            <Route path="/tool1-eval" element={<ProtectedRoute><Tool1EvalPage /></ProtectedRoute>} />
            <Route path="/tool2-intro" element={<ProtectedRoute><Tool2IntroPage /></ProtectedRoute>} />
            <Route path="/tool2" element={<ProtectedRoute><Tool2LayoutPage /></ProtectedRoute>} />
            <Route path="/tool2-eval" element={<ProtectedRoute><Tool2EvalPage /></ProtectedRoute>} />
            <Route path="/tool3-intro" element={<ProtectedRoute><Tool3IntroPage /></ProtectedRoute>} />
            <Route path="/tool3" element={<ProtectedRoute><Tool3PanelPage /></ProtectedRoute>} />
            <Route path="/tool3-eval" element={<ProtectedRoute><Tool3EvalPage /></ProtectedRoute>} />
            <Route path="/final-survey" element={<ProtectedRoute><FinalSurveyPage /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </Router>
    </TaskTimerProvider>
  );
}

export default App;
