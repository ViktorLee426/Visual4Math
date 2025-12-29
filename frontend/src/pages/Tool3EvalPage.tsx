import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';
import { submitEvaluation } from '../services/trackingApi';

interface LikertQuestion {
    id: string;
    question: string;
    required: boolean;
}

interface TextQuestion {
    id: string;
    question: string;
    required: boolean;
}

interface EvaluationCategory {
    title: string;
    likertQuestions?: LikertQuestion[];
    textQuestions?: TextQuestion[];
}

// Structured evaluation questions by category
const evaluationCategories: EvaluationCategory[] = [
    {
        title: 'Ease of Use and Learnability',
        likertQuestions: [
            {
                id: 'easy_to_learn',
                question: 'I found this tool easy to learn and use',
                required: true
            },
            {
                id: 'confident_creating',
                question: 'I felt confident creating visuals with this tool',
                required: true
            },
            {
                id: 'expected_behavior',
                question: 'The tool behaved in ways I expected',
                required: true
            }
        ]
    },
    {
        title: 'Mental Load and Frustration',
        likertQuestions: [
            {
                id: 'mental_effort',
                question: 'It required a lot of mental effort to use this tool effectively',
                required: true
            },
            {
                id: 'frustrated',
                question: 'I felt frustrated while using this tool',
                required: true
            }
        ]
    },
    {
        title: 'Educational Fit and Usefulness',
        likertQuestions: [
            {
                id: 'matched_objects',
                question: 'The image matched the number of objects I needed for the math problem',
                required: true
            },
            {
                id: 'communicate_concept',
                question: 'This tool helped me communicate the math concept effectively',
                required: true
            },
            {
                id: 'comfortable_teaching',
                question: 'I would feel comfortable using visuals from this tool in my actual teaching',
                required: true
            }
        ]
    },
    {
        title: 'Creativity and Reuse Potential',
        likertQuestions: [
            {
                id: 'gave_ideas',
                question: 'This tool gave me ideas for how to visualize the math scenario',
                required: true
            },
            {
                id: 'use_again',
                question: 'I would use a tool like this again for other teaching visuals',
                required: true
            }
        ]
    },
    {
        title: 'Open Feedback',
        textQuestions: [
            {
                id: 'likes_dislikes',
                question: 'What did you like or dislike about this tool?',
                required: false
            },
            {
                id: 'improvements',
                question: 'What would you improve or change?',
                required: false
            }
        ]
    }
];

export default function Tool3EvalPage() {
    // State for Likert scale responses (numbers)
    // Note: Text responses for open feedback are collected during the interview
    const [likertResponses, setLikertResponses] = useState<Record<string, number>>({});
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            console.warn('No session found, but continuing in dev mode');
            // In dev mode, don't redirect - just continue
        } else {
            sessionManager.updatePhase('tool3-eval');
        }
    }, [navigate]);

    // Handle Likert scale responses (1-7)
    const handleLikertChange = (questionId: string, value: number) => {
        setLikertResponses(prev => ({ ...prev, [questionId]: value }));
        
        // Track evaluation response
        const session = sessionManager.getParticipantData();
        const sessionId = sessionStorage.getItem('tracking_session_id');
        if (session && sessionId) {
            // Find the question text
            const question = evaluationCategories
                .flatMap(cat => cat.likertQuestions || [])
                .find(q => q.id === questionId);
            
            if (question) {
                submitEvaluation(
                    session.participantId,
                    parseInt(sessionId),
                    'tool_c',
                    questionId,
                    question.question,
                    value
                ).catch(err => console.error('Failed to track evaluation:', err));
            }
        }
    };

    // Note: Text responses for open feedback questions are collected during the interview

    const handleBackToInstructions = () => {
        // Save responses before navigating
        // Text responses for open feedback are collected during the interview
        const textResponses: Record<string, string> = {};
        const allResponses = { ...likertResponses, ...textResponses };
        sessionManager.savePhaseData('tool3-eval', { 
            likertResponses, 
            textResponses,
            allResponses 
        });
        navigate('/instructions');
    };

    // Check if all required Likert questions are answered
    const allRequiredLikertAnswered = evaluationCategories
        .flatMap(cat => cat.likertQuestions || [])
        .every(q => !q.required || (likertResponses[q.id] !== undefined && likertResponses[q.id] > 0));

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool3-eval" />

            <div className="min-h-screen flex items-start justify-center px-4 pt-16 pb-8 ml-56">
                <div className="max-w-6xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">
                        Evaluation: Tool C (Free Manipulation Interface)
                    </h1>
                    
                    <div className="space-y-4">
                        <p className="text-base text-gray-600 text-center">
                            Please rate your agreement with each statement on a scale of 1 (Strongly Disagree) to 7 (Strongly Agree).
                        </p>
                        
                        {/* Separate box for each category */}
                        {evaluationCategories.map((category, catIndex) => (
                            <div key={catIndex} className="bg-white rounded-lg p-6 border border-gray-200">
                                {/* Category Title */}
                                <h2 className="text-lg font-semibold text-gray-900 border-b-2 border-gray-300 pb-2 mb-4">
                                    {category.title}
                                </h2>
                                
                                <div className="space-y-5">
                                    {/* Likert Scale Questions */}
                                    {category.likertQuestions && category.likertQuestions.map((question) => (
                                        <div key={question.id} className="space-y-3">
                                            <label className="block text-base font-medium text-gray-900">
                                                {question.question}
                                                {question.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-gray-500 w-28 flex-shrink-0">Strongly Disagree</span>
                                                <div className="flex gap-3 flex-1 justify-between items-center px-2">
                                                    {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                                                        <label
                                                            key={value}
                                                            className="flex flex-col items-center cursor-pointer flex-1"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={question.id}
                                                                value={value}
                                                                checked={likertResponses[question.id] === value}
                                                                onChange={() => handleLikertChange(question.id, value)}
                                                                className="w-5 h-5 text-gray-900 focus:ring-gray-500"
                                                            />
                                                            <span className="text-xs text-gray-600 mt-1">{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <span className="text-sm text-gray-500 w-28 flex-shrink-0 text-right">Strongly Agree</span>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Text Questions (for Open Feedback - displayed but no input) */}
                                    {category.textQuestions && category.textQuestions.map((question) => (
                                        <div key={question.id} className="space-y-2 mb-6">
                                            <p className="block text-base font-medium text-gray-900">
                                                {question.question}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <PageNavigation 
                        currentPage={10} 
                        onBack={() => navigate('/tool3')}
                        backLabel="Back to Tool C Task"
                        onNext={handleBackToInstructions}
                        nextLabel="Back to Instructions"
                        showBack={true}
                        showNext={true}
                    />
                    
                    {!allRequiredLikertAnswered && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                            Note: You can navigate freely, but answering all required questions is recommended.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

