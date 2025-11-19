// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import Tool1IntroPage from "./pages/Tool1IntroPage";
import Tool1ChatPage from "./pages/Tool1ChatPage";
import Tool1EvalPage from "./pages/Tool1EvalPage";
import Tool2IntroPage from "./pages/Tool2IntroPage";
import Tool2LayoutPage from "./pages/Tool2LayoutPage";
import Tool2EvalPage from "./pages/Tool2EvalPage";
import Tool3IntroPage from "./pages/Tool3IntroPage";
import Tool3PanelPage from "./pages/Tool3PanelPage";
import Tool3EvalPage from "./pages/Tool3EvalPage";
import FinalComparisonPage from "./pages/FinalComparisonPage";
import FinalSurveyPage from "./pages/FinalSurveyPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/tool1-intro" element={<Tool1IntroPage />} />
        <Route path="/tool1" element={<Tool1ChatPage />} />
        <Route path="/tool1-eval" element={<Tool1EvalPage />} />
        <Route path="/tool2-intro" element={<Tool2IntroPage />} />
        <Route path="/tool2" element={<Tool2LayoutPage />} />
        <Route path="/tool2-eval" element={<Tool2EvalPage />} />
        <Route path="/tool3-intro" element={<Tool3IntroPage />} />
        <Route path="/tool3" element={<Tool3PanelPage />} />
        <Route path="/tool3-eval" element={<Tool3EvalPage />} />
        <Route path="/final-comparison" element={<FinalComparisonPage />} />
        <Route path="/final-survey" element={<FinalSurveyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
