import { useNavigate } from 'react-router-dom';
import TimeProportionalProgress from '../components/TimeProportionalProgress';

export default function WelcomePage() {
    const navigate = useNavigate();

    const handleContinue = () => {
        navigate('/instructions');
    };

    return (
        <div className="min-h-screen bg-white flex relative">
            <TimeProportionalProgress currentPhase="welcome" />
            
            {/* Main content with left sidebar for progress */}
            <div className="flex-1 min-h-screen flex items-start justify-center px-8 py-8 ml-56 pt-16">
                <div className="max-w-6xl w-full space-y-6">
                    {/* Welcome heading */}
                    <div className="text-center space-y-3">
                        <h1 className="text-3xl font-semibold text-gray-900">Welcome</h1>
                        <p className="text-gray-600 text-base leading-relaxed">
                            Thank you for participating in this user study. This study is conducted by the <strong>PEACH Lab at ETH Zurich</strong>. 
                            The study will take approximately <strong>1 hour</strong> to complete.
                        </p>
                    </div>
                    
                    {/* Purpose section */}
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900 mb-3 text-center">About This Study</h2>
                        <div className="space-y-3 text-base text-gray-700">
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5">Why this study?</h3>
                                <p className="leading-relaxed">
                                    Images are important and useful in teaching—they help students understand questions and keep them engaged. 
                                    With generative AI becoming more popular, it is important to leverage these technologies in educational settings 
                                    to support teachers in creating effective visual learning materials.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5">What will I do?</h3>
                                <p className="leading-relaxed">
                                    In this study, you will try three different AI-powered tools for creating visual representations of math word problems. 
                                    Each tool offers a different interaction approach, and we're interested in learning about your experience with each one.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Important information */}
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900 mb-3 text-center">Notes</h2>
                        <div className="space-y-3 text-base text-gray-700">
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5">Think-aloud protocol</h3>
                                <p className="leading-relaxed">
                                    Please verbalize your thoughts as you work—speak aloud what you think in your mind so we can understand your thinking process. 
                                    Share what you're trying to achieve, how you're planning to use the tool, your reactions, 
                                    and any frustrations or satisfactions you experience.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1.5">Record the Screen</h3>
                                <p className="leading-relaxed">
                                    We will ask you to share your screen and record it during the study. Please hide your personal information 
                                    and only share the web application page where the task is displayed. Make sure that your microphone is working properly.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Continue button */}
                    <div className="space-y-4">
                        <button
                            onClick={handleContinue}
                            className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg hover:bg-gray-800 transition-colors text-base font-medium"
                        >
                            Continue to Instructions →
                        </button>
                        
                        <p className="text-xs text-gray-500 text-center">
                            Your participation is voluntary and you may withdraw at any time.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
    
