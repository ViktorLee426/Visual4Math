// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WelcomePage from "./pages/LoginPage"; // Using existing file as WelcomePage
import ConsentPage from "./pages/ConsentPage";
import DemographicSurveyPage from "./pages/DemographicSurveyPage";
import ClosedTaskInstructionsPage from "./pages/ClosedTaskInstructionsPage";
import ClosedTaskPage from "./pages/ClosedTaskPage";
import OpenTaskInstructionsPage from "./pages/OpenTaskInstructionsPage";
import OpenTaskPage from "./pages/OpenTaskPage";
import FinalSurveyPage from "./pages/FinalSurveyPage";
import CompletionPage from "./pages/CompletionPage";



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/demographics" element={<DemographicSurveyPage />} />
        <Route path="/closed-instructions" element={<ClosedTaskInstructionsPage />} />
        <Route path="/closed-task/:taskId" element={<ClosedTaskPage />} />
        <Route path="/open-instructions" element={<OpenTaskInstructionsPage />} />
        <Route path="/open-task/:taskId" element={<OpenTaskPage />} />
        <Route path="/final-survey" element={<FinalSurveyPage />} />
        <Route path="/completion" element={<CompletionPage />} />
      </Routes>
    </Router>
  );
}

export default App;
