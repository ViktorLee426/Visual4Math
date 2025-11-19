import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';

interface InterviewQuestion {
    id: string;
    question: string;
    subQuestions?: string[];
}

const interviewQuestions: InterviewQuestion[] = [
    {
        id: 'overall',
        question: 'How was your overall experience with those 3 tools, is there any tool that leaves you very positive / negative experience and can you explain why?'
    },
    {
        id: 'conversational',
        question: 'Question regarding the conversational tool:',
        subQuestions: [
            'How is your experience with the chatbox mode image creation in general?',
            'Are you satisfied with the quality of the generation results in each iteration?',
            'Do you think the brush modification helps with those iterations?',
            'Do you think this is mentally demanding?'
        ]
    },
    {
        id: 'layout',
        question: 'Question regarding the layout-based tool:',
        subQuestions: [
            'How is your overall experience?',
            'Are you satisfied with the quality of the generation results? Compared to the conversational interface?',
            'Did you feel better sense of control for the image creation?',
            'Do you think adjust the layout is tiring? Do you like the proposed layout in the canvas?'
        ]
    },
    {
        id: 'free_editing',
        question: 'Question regarding the free editing tool:',
        subQuestions: [
            'How is your overall experience?',
            'Are you satisfied with the generated image, compared with other two tools?',
            'How do you think the quality of the proposed structure in the canvas?',
            'Do you feel more sense of control for the image creation?'
        ]
    }
];

export default function FinalSurveyPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        sessionManager.updatePhase('final-survey');
    }, [navigate]);

    const handleComplete = () => {
        // Mark as completed
        sessionManager.savePhaseData('final-survey', { completed: true, timestamp: new Date().toISOString() });
        sessionManager.updatePhase('completion');
        
        // Show completion message
        alert('Thank you for participating in the study! Your compensation will be sent to your email after we verify and analyze the recording.');
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Very top center logo */}
            <div className="fixed top-0 left-0 w-full flex justify-center py-1 bg-white z-20">
                <img 
                    src={eth_peach} 
                    alt="ETH Zurich PEACH Lab" 
                    className="h-8 w-auto" 
                />
            </div>
            
            <TimeProportionalProgress currentPhase="final-survey" />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24 pb-8">
                <div className="max-w-4xl w-full space-y-8">
                    <h1 className="text-3xl font-bold text-gray-800 text-center mb-4">
                        Final Post-Study Survey Interview
                    </h1>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-blue-900 text-center">
                            <strong>Note:</strong> The following questions will be discussed during the semi-structured interview.
                        </p>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-8">
                        {/* Question 1 */}
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-gray-900">
                                1. {interviewQuestions[0].question}
                            </h2>
                        </div>

                        {/* Question 2 */}
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">
                                2. {interviewQuestions[1].question}
                            </h2>
                            <div className="ml-6 space-y-3">
                                {interviewQuestions[1].subQuestions?.map((subQ, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <p className="text-base text-gray-800">
                                            <span className="font-medium">2.{idx + 1}</span> - {subQ}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Question 3 */}
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">
                                3. {interviewQuestions[2].question}
                            </h2>
                            <div className="ml-6 space-y-3">
                                {interviewQuestions[2].subQuestions?.map((subQ, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <p className="text-base text-gray-800">
                                            <span className="font-medium">3.{idx + 1}</span> - {subQ}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Question 4 */}
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">
                                4. {interviewQuestions[3].question}
                            </h2>
                            <div className="ml-6 space-y-3">
                                {interviewQuestions[3].subQuestions?.map((subQ, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <p className="text-base text-gray-800">
                                            <span className="font-medium">4.{idx + 1}</span> - {subQ}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                        <button
                            onClick={() => navigate('/final-comparison')}
                            className="px-8 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-lg font-semibold transition-colors"
                        >
                            ← Back to Final Comparison
                        </button>
                        
                        <button
                            onClick={handleComplete}
                            className="px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-lg font-semibold transition-colors"
                        >
                            Complete Study
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
