// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import TopHeader from "./components/TopHeader";
import WelcomePage from "./pages/WelcomePage";

// Lazy load pages - only load when needed (faster initial page load)
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

// Loading component shown while lazy-loaded pages are loading
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-gray-600">Loading...</div>
  </div>
);

function App() {
  return (
    <Router>
      {/* Top header with logos - appears on all pages */}
      <TopHeader />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/tool1-intro" element={<Tool1IntroPage />} />
          <Route path="/tool1" element={<Tool1ChatPage />} />
          <Route path="/tool1-eval" element={<Tool1EvalPage />} />
          <Route path="/tool2-intro" element={<Tool2IntroPage />} />
          <Route path="/tool2" element={<Tool2LayoutPage />} />
          <Route path="/tool2-eval" element={<Tool2EvalPage />} />
          <Route path="/tool3-intro" element={<Tool3IntroPage />} />
          <Route path="/tool3" element={<Tool3PanelPage />} />
          <Route path="/tool3-eval" element={<Tool3EvalPage />} />
          <Route path="/final-survey" element={<FinalSurveyPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
