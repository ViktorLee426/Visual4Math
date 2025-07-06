import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import labLogo from "../assets/lab_logo.png"; // Assuming you have a logo image in the assets folder
import labLogowithName from "../assets/lab_logo_with_name.png"; 

export default function LoginPage() {
    const [name, setName] = useState('');
    const navigate = useNavigate(); //is a react router hook, gives a function to go to another route.
     //is a function expression that is assigned to a const, works the same as regular function here. 
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault();
        if (name.trim()) {
            // You could store the name temporarily for now
            localStorage.setItem('username', name);
            navigate('/chat'); // Navigate to the chat page
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
            <div className="max-w-md w-full text-center space-y-6">
                <img
                src={labLogowithName}
                alt="PEACH Lab Logo"
                className="mx-auto w-60 h-70 mb-6"
                />
                <h1 className="text-3xl font-bold text-gray-800">Welcome to Visual4Math</h1>
                <p className="text-gray-700 text-sm leading-relaxed text-left space-y-2">
                <strong>Hello and thank you for participating in this user experiment!</strong><br /><br />
                This study is conducted by the <strong>PEACH Lab at ETH Zurich</strong>. Our objective is to explore how educators interact with generative AI tools to create pedagogical visuals.<br /><br />
                By observing your interaction with AI, we aim to better understand your preferences, expectations, and challenges. These insights will help shape future AI systems focused on education.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Enter your name"
                        className="w-full px-4 py-2 border rounded shadow"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                        Enter
                    </button>
                </form>
            </div>
        </div>
    );
}
    
