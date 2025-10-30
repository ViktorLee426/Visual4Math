import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import { submitSurvey } from '../services/researchApi';
import HorizontalProgress from '../components/HorizontalProgress';

interface SurveyQuestion {
    id: string;
    type: 'likert' | 'text' | 'multiple_choice';
    question: string;
    options?: string[];
    required: boolean;
}

const surveyQuestions: SurveyQuestion[] = [
    {
        id: 'overall_experience',
        type: 'likert',
        question: 'How would you rate your overall experience using the AI assistant for creating mathematical visuals?',
        required: true
    },
    {
        id: 'ease_of_use',
        type: 'likert',
        question: 'How easy was it to communicate your visualization needs to the AI assistant?',
        required: true
    },
    {
        id: 'result_quality',
        type: 'likert',
        question: 'How satisfied were you with the quality of the generated mathematical visuals?',
        required: true
    },
    {
        id: 'pedagogical_value',
        type: 'likert',
        question: 'How would you rate the pedagogical value of the visualizations created with the AI assistant?',
        required: true
    },
    {
        id: 'time_efficiency',
        type: 'likert',
        question: 'How efficient was using the AI assistant compared to your usual methods of creating mathematical visuals?',
        required: true
    },
    {
        id: 'classroom_use',
        type: 'likert',
        question: 'How likely would you be to use a tool like this in your classroom or teaching practice?',
        required: true
    },
    {
        id: 'ai_comfort_after',
        type: 'likert',
        question: 'After this experience, how comfortable do you feel using AI tools for educational purposes?',
        required: true
    },
    {
        id: 'closed_vs_open',
        type: 'multiple_choice',
        question: 'Which type of task did you find more engaging?',
        options: ['Closed tasks (with target images)', 'Open tasks (creative freedom)', 'Both equally', 'Neither'],
        required: true
    },
    {
        id: 'biggest_challenge',
        type: 'text',
        question: 'What was the biggest challenge you encountered when working with the AI assistant?',
        required: true
    },
    {
        id: 'most_helpful',
        type: 'text',
        question: 'What did you find most helpful about using AI for creating mathematical visuals?',
        required: true
    },
    {
        id: 'improvements',
        type: 'text',
        question: 'What improvements or additional features would make this tool more useful for your teaching? (Consider: Are you comfortable chatting with AI? Would you prefer another input method like sketching? What kind of output format would be most useful - images, editable elements, etc.?)',
        required: true
    },
    {
        id: 'student_benefit',
        type: 'text',
        question: 'How do you think your students would benefit from visualizations created with this AI assistant?',
        required: true
    },
    {
        id: 'additional_comments',
        type: 'text',
        question: 'Any additional comments or feedback about your experience?',
        required: false
    }
];

export default function FinalSurveyPage() {
    const [responses, setResponses] = useState<Record<string, string | number>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        console.log('FinalSurveyPage mounted');
        const session = sessionManager.getParticipantData();
        if (!session) {
            console.log('No session found, redirecting to login');
            navigate('/');
            return;
        }

        console.log('Current phase:', session.currentPhase);
        console.log('Completed phases:', session.completedPhases);
        
        // Check if we came from open-task-2
        const openTask2Completed = session.completedPhases.includes('open-task-2');
        console.log('Open task 2 completed:', openTask2Completed);
        
        // Remove auto-redirect to completion page to ensure survey is shown
        // if (sessionManager.isPhaseCompleted('final-survey')) {
        //     navigate('/completion');
        //     return;
        // }

        const existingData = sessionManager.getPhaseData('final-survey');
        if (existingData && existingData.responses) {
            console.log('Found existing survey responses');
            const responseMap: Record<string, string> = {};
            existingData.responses.forEach((resp: any) => {
                responseMap[resp.question_id] = resp.response_value;
            });
            setResponses(responseMap);
        }

        sessionManager.updatePhase('final-survey');
        console.log('Updated phase to final-survey');
    }, [navigate]);

    const handleResponseChange = (questionId: string, value: string) => {
        // For Likert scales, store as number, otherwise as string
        const questionType = surveyQuestions.find(q => q.id === questionId)?.type;
        const processedValue = questionType === 'likert' ? parseInt(value) : value;
        
        setResponses(prev => ({ ...prev, [questionId]: processedValue }));
        console.log(`Question ${questionId} updated:`, processedValue);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log('Submitting survey responses...', responses);
        
        // Validate required questions
        const missingRequired = surveyQuestions
            .filter(q => q.required && !responses[q.id])
            .map(q => q.question);
        
        if (missingRequired.length > 0) {
            setError('Please answer all required questions.');
            console.log('Missing required questions:', missingRequired);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const participantData = sessionManager.getParticipantData();
            if (!participantData) {
                throw new Error('No participant session found');
            }

            // Ensure all values are strings for the API
            const processedResponses = Object.entries(responses).reduce((acc, [key, value]) => {
                acc[key] = value !== undefined ? value.toString() : '';
                return acc;
            }, {} as Record<string, string>);

            const surveyData = {
                participant_id: participantData.participantId,
                survey_type: 'final',
                responses: surveyQuestions.map(q => ({
                    question_id: q.id,
                    question_text: q.question,
                    response_type: q.type,
                    response_value: processedResponses[q.id] || ''
                }))
            };

            console.log('Survey data to submit:', surveyData);
            
            await submitSurvey(surveyData);
            console.log('Survey submitted successfully');
            
            sessionManager.savePhaseData('final-survey', surveyData);
            sessionManager.updatePhase('completion');

            navigate('/completion');

        } catch (error: any) {
            console.error('Error submitting survey:', error);
            if (error.response) {
                console.error('API error response:', error.response.data);
                console.error('Status:', error.response.status);
            }
            setError('Failed to submit survey. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getLikertLabels = (questionId: string) => {
        switch(questionId) {
            case 'overall_experience':
                return {
                    start: 'Very Negative',
                    end: 'Very Positive',
                    labels: ['Very Negative', 'Negative', 'Slightly Negative', 'Neutral', 'Slightly Positive', 'Positive', 'Very Positive']
                };
            case 'ease_of_use':
                return {
                    start: 'Very Hard',
                    end: 'Very Easy',
                    labels: ['Very Hard', 'Hard', 'Somewhat Hard', 'Neutral', 'Somewhat Easy', 'Easy', 'Very Easy']
                };
            case 'result_quality':
                return {
                    start: 'Not Satisfied',
                    end: 'Very Satisfied',
                    labels: ['Not Satisfied', 'Mostly Unsatisfied', 'Slightly Unsatisfied', 'Neutral', 'Slightly Satisfied', 'Mostly Satisfied', 'Very Satisfied']
                };
            case 'pedagogical_value':
                return {
                    start: 'Not Valuable',
                    end: 'Very Valuable',
                    labels: ['Not Valuable', 'Low Value', 'Somewhat Low Value', 'Neutral', 'Somewhat Valuable', 'Valuable', 'Very Valuable']
                };
            case 'time_efficiency':
                return {
                    start: 'Very Inefficient',
                    end: 'Very Efficient',
                    labels: ['Very Inefficient', 'Inefficient', 'Somewhat Inefficient', 'Neutral', 'Somewhat Efficient', 'Efficient', 'Very Efficient']
                };
            case 'classroom_use':
                return {
                    start: 'Very Unlikely',
                    end: 'Very Likely',
                    labels: ['Very Unlikely', 'Unlikely', 'Somewhat Unlikely', 'Neutral', 'Somewhat Likely', 'Likely', 'Very Likely']
                };
            case 'ai_comfort_after':
                return {
                    start: 'Very Uncomfortable',
                    end: 'Very Comfortable',
                    labels: ['Very Uncomfortable', 'Uncomfortable', 'Somewhat Uncomfortable', 'Neutral', 'Somewhat Comfortable', 'Comfortable', 'Very Comfortable']
                };
            default:
                return {
                    start: 'Strongly Disagree',
                    end: 'Strongly Agree',
                    labels: ['Strongly Disagree', 'Disagree', 'Somewhat Disagree', 'Neutral', 'Somewhat Agree', 'Agree', 'Strongly Agree']
                };
        }
    };

    const renderLikertScale = (questionId: string) => {
        const { start, end, labels } = getLikertLabels(questionId);
        // Handle both string and number types for responses
        const response = responses[questionId];
        const rating = typeof response === 'number' ? response : (response ? parseInt(response) : 4); // Default to 4 (middle) if not set
        
        return (
            <div className="mt-4">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-600">{start}</span>
                    <span className="text-sm text-gray-600">{end}</span>
                </div>
                <div className="relative px-2">
                    <input
                        type="range"
                        min="1"
                        max="7"
                        value={rating}
                        onChange={(e) => handleResponseChange(questionId, e.target.value)}
                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer custom-slider"
                        style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((rating - 1) / 6) * 100}%, #e5e7eb ${((rating - 1) / 6) * 100}%, #e5e7eb 100%)`
                        }}
                    />
                    <div className="flex justify-between mt-2">
                        {[1, 2, 3, 4, 5, 6, 7].map(r => (
                            <div key={r} className="flex flex-col items-center" style={{ width: '14.28%' }}>
                                <div 
                                    className={`h-6 w-6 rounded-full flex items-center justify-center mb-1 ${
                                        rating === r
                                            ? 'bg-blue-600 text-white font-bold' 
                                            : 'bg-white text-gray-500'
                                    }`}
                                    onClick={() => handleResponseChange(questionId, r.toString())}
                                >
                                    {r}
                                </div>
                                <span className="text-xs text-center">{labels[r-1]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    console.log('Rendering FinalSurveyPage');
    
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
            
            <HorizontalProgress currentPage={10} />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-4xl w-full space-y-8">
                    <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">Teacher Feedback Survey</h1>
                    
                    <div className="text-gray-700 text-center mb-6">
                        Thank you for participating in our study! Your feedback is invaluable and will help us understand how AI tools can support mathematics education and improve our tools for teachers. The survey consists of rating scales followed by open-ended questions.
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {surveyQuestions.map((question, index) => (
                            <div key={question.id} className="border-b border-gray-200 pb-6">
                                <div className="mb-4">
                                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                                        {index + 1}. {question.question}
                                        {question.required && <span className="text-red-500 ml-1">*</span>}
                                    </h3>
                                </div>

                                {question.type === 'likert' && renderLikertScale(question.id)}

                                {question.type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                        {question.options?.map(option => (
                                            <label key={option} className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    name={question.id}
                                                    value={option}
                                                    checked={responses[question.id] === option}
                                                    onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-gray-700">{option}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {question.type === 'text' && (
                                    <textarea
                                        value={responses[question.id] || ''}
                                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                        placeholder="Please share your thoughts..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                                        required={question.required}
                                    />
                                )}
                            </div>
                        ))}

                        {error && (
                            <div className="text-red-600 text-sm">{error}</div>
                        )}

                        <div className="flex justify-between pt-6">
                            <button
                                type="button"
                                onClick={() => navigate('/open-task/2')}
                                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Back to Tasks
                            </button>
                            
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-semibold"
                            >
                                {isLoading ? 'Submitting...' : 'Submit Feedback & Complete Study'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
