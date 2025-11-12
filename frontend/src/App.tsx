// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import InstructionsPage from "./pages/InstructionsPage";
import Tool1ChatPage from "./pages/Tool1ChatPage";
import FinalSurveyPage from "./pages/FinalSurveyPage";
import Tool2LayoutPage from "./pages/Tool2LayoutPage";
import Tool3PanelPage from "./pages/Tool3PanelPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/instructions" element={<InstructionsPage />} />
        <Route path="/tool1" element={<Tool1ChatPage />} />
        <Route path="/tool2" element={<Tool2LayoutPage />} />
        <Route path="/tool3" element={<Tool3PanelPage />} />
        <Route path="/feedback" element={<FinalSurveyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
