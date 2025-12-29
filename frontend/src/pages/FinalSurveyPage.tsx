import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import { endSession } from '../services/trackingApi';

interface InterviewQuestion {
    id: string;
    question: string;
    subQuestions?: string[];
}

const interviewQuestions: InterviewQuestion[] = [
    {
        id: 'general_reflection',
        question: 'General Reflection (across all tools)',
        subQuestions: [
            'Can you walk me through your overall experience with the three tools?',
            'Was there a tool that felt especially helpful or frustrating? Why?',
            'Which tool gave you the most control over the final image, and how?',
            'Which one do you think best supports your needs as a teacher?'
        ]
    },
    {
        id: 'conversational',
        question: 'Conversational Tool (Chatbot)',
        subQuestions: [
            'What was your experience like using the chatbox to create images?',
            'How did the quality of image generation feel across different prompts?',
            'How did you find the process of making edits using the brush?',
            'In what ways did this tool feel mentally demanding or straightforward?'
        ]
    },
    {
        id: 'layout',
        question: 'Layout-Based Tool',
        subQuestions: [
            'How did it feel to work with a visual layout for creating images?',
            'What was your impression of the proposed layout from the system?',
            'Did editing the layout help you get closer to what you wanted? Why or why not?',
            'Were there any moments where layout adjustments felt confusing or time-consuming?'
        ]
    },
    {
        id: 'free_editing',
        question: 'Direct Editing Tool (Free editing)',
        subQuestions: [
            'How was your experience editing the image directly on the canvas?',
            'What did you think of the initial structure proposed by the system?',
            'Did this tool give you a greater sense of control over the image? How?',
            'Compared to the other tools, how satisfied were you with the results here?'
        ]
    }
];

export default function FinalSurveyPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        // Allow access even without session for navigation purposes
        // Just update phase if session exists
        if (session) {
            sessionManager.updatePhase('final-survey');
        }
    }, []);

    const handleComplete = async () => {
        // Mark as completed
        sessionManager.savePhaseData('final-survey', { completed: true, timestamp: new Date().toISOString() });
        sessionManager.updatePhase('completion');
        
        // End tracking session
        const session = sessionManager.getParticipantData();
        const sessionId = sessionStorage.getItem('tracking_session_id');
        if (session && sessionId) {
            try {
                await endSession(session.participantId, parseInt(sessionId));
            } catch (err) {
                console.error('Failed to end tracking session:', err);
            }
        }
        
        // Show completion message
        alert('Thank you for participating in the study! Your compensation will be sent to your email after we verify and analyze the recording.');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="final-survey" />

            <div className="min-h-screen flex items-start justify-center px-8 pt-16 pb-8 ml-56">
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
                        {/* Question 1 - General Reflection */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                1. {interviewQuestions[0].question}
                            </h2>
                            <div className="ml-6 space-y-3">
                                {interviewQuestions[0].subQuestions?.map((subQ, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <p className="text-base text-gray-800">
                                            <span className="font-medium">1.{idx + 1}</span> - {subQ}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Question 2 - Conversational Tool */}
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

                        {/* Question 3 - Layout-Based Tool */}
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

                        {/* Question 4 - Direct Editing Tool */}
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
                            onClick={() => navigate('/tool3-eval')}
                            className="px-8 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-lg font-semibold transition-colors"
                        >
                            ← Back to Evaluation
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
