import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png"
import { sessionManager } from '../utils/sessionManager';
import HorizontalProgress from '../components/HorizontalProgress';

export default function WelcomePage() {
    const [participantId, setParticipantId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Clear any existing session on component mount for fresh starts
    useEffect(() => {
        // Clear previous session to start fresh
        sessionManager.clearSession();
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!participantId.trim()) {
            setError('Please enter a participant ID');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            console.log('Proceeding with participant:', participantId);
            
            // Skip backend registration - just proceed directly
            // Initialize session manager
            sessionManager.initializeParticipant(participantId);
            
            // Store participant ID in localStorage for backup
            localStorage.setItem('participant_id', participantId);
            
            // Navigate to consent page
            sessionManager.updatePhase('consent');
            navigate('/consent');
            
        } catch (error) {
            console.error('❌ Error with participant setup:', error);
            setError('Failed to proceed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white relative">
            {/* Very top center logo */}
            <div className="fixed top-0 left-0 w-full flex justify-center py-1 bg-white z-20">
                <img 
                    src={eth_peach} 
                    alt="ETH Zurich PEACH Lab" 
                    className="h-8 w-auto" 
                />
            </div>
            
            <HorizontalProgress currentPage={1} />
            
            {/* Main content */}
            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-6xl w-full text-center space-y-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-8">Welcome to our Study</h1>
                    <div className="text-gray-700 text-xl leading-relaxed text-left space-y-4 max-w-5xl mx-auto">
                        <p><strong>Hello and thank you for participating in this user experiment!</strong></p>
                        
                        <p>This study is conducted by the <strong>PEACH Lab at ETH Zurich</strong>. Our objective is to explore how educators interact with generative AI tools to create pedagogical visuals.</p>
                        
                        <p>By observing your interaction with AI, we aim to better understand your preferences, expectations, and challenges. These insights will help shape future AI systems focused on education.</p>
                        
                        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                            <p className="text-blue-800"><strong>Study Information:</strong></p>
                            <ul className="list-disc list-inside text-blue-700 space-y-1">
                                <li>Duration: Approximately 60 minutes</li>
                                <li>Tasks: Create mathematical visuals using AI</li>
                                <li>Method: Think-aloud protocol with screen recording</li>
                                <li>Data: All interactions will be recorded for research purposes</li>
                            </ul>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
                        <div>
                            <input
                                type="text"
                                placeholder="Enter your participant ID"
                                className="w-full px-6 py-4 border rounded-lg shadow text-xl"
                                value={participantId}
                                onChange={(e) => setParticipantId(e.target.value)}
                                disabled={isLoading}
                            />
                            {error && (
                                <p className="text-red-600 text-sm mt-2">{error}</p>
                            )}
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-4 text-xl rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Registering...' : 'Begin Study'}
                        </button>
                        
                        <p className="text-sm text-gray-500 mt-4">
                            Your participation is voluntary and you may withdraw at any time.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
    
