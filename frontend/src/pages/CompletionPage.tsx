import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import HorizontalProgress from '../components/HorizontalProgress';

export default function CompletionPage() {
    const navigate = useNavigate();

    useEffect(() => {
        console.log('CompletionPage mounted');
        const session = sessionManager.getParticipantData();
        if (!session) {
            console.log('No session found, redirecting to login');
            navigate('/');
            return;
        }

        console.log('Current phase before completion:', session.currentPhase);
        console.log('Completed phases:', session.completedPhases);

        // Mark study as completed - don't redirect even if survey wasn't completed
        // This allows for flexible testing and troubleshooting
        sessionManager.updatePhase('completion');
        console.log('Updated phase to completion');
    }, [navigate]);

    const handleNewSession = () => {
        if (window.confirm('This will clear all current session data. Are you sure?')) {
            sessionManager.clearSession();
            navigate('/');
        }
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
            
            <HorizontalProgress currentPage={11} />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-3xl w-full text-center space-y-8">
                    <div className="space-y-6">
                        <div className="text-6xl text-green-500 mb-4">✓</div>
                        <h1 className="text-4xl font-bold text-gray-800">Study Completed!</h1>
                        <p className="text-xl text-gray-600">
                            Thanks a lot for participating! Your session has been completed successfully.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-gray-800">What Happens Next?</h2>
                        <div className="text-left space-y-3 max-w-2xl mx-auto text-gray-700">
                            <p>
                                <strong>1. Wait for compensation:</strong> Your compensation will be sent to your email 
                                after we review the recording and make sure there are no unexpected errors.
                            </p>
                            <p>
                                <strong>2. Confidentiality:</strong> All data remains protected and confidential and 
                                will only be used for the research purpose as outlined in the consent form.
                            </p>
                            <p>
                                <strong>3. Contact information:</strong> If you have any questions, please 
                                contact the researcher of this study at zhengxli@ethz.ch
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <p className="text-blue-700">
                            Thanks again for your contribution! Wish you a pleasant day!
                        </p>
                    </div>
                    
                    <div className="space-y-4 pt-6">
                        <button
                            onClick={handleNewSession}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            Return to Start
                        </button>
                        
                        <p className="text-xs text-gray-500">
                            You may close this browser tab.
                        </p>
                    </div>

                    <div className="pt-8 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            PEACH Lab, ETH Zurich • Department of Computer Science<br/>
                            {new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
