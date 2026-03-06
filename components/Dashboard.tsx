import React, { useState, useEffect } from 'react';
import { View, DashboardStats } from '../types';
import { UserIcon, UsersIcon, ShareIcon, ExclamationIcon } from './icons';
import PersonalFilesView from './views/PersonalFilesView';
import FamilyFilesView from './views/FamilyFilesView';
import ReferralFilesView from './views/ReferralFilesView';
import EmergencyFilesView from './views/EmergencyFilesView';
import { API_BASE_URL } from '../config';

interface DashboardProps {
    onLogout: () => void;
}

const DashboardContent: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('No authentication token found');
                }

                const response = await fetch(`${API_BASE_URL}/api/stats`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch stats');
                }
                const data = await response.json();
                setStats(data);
            } catch (err: any) {
                setError(err.message || 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">Loading dashboard stats...</div>;
    }

    if (error || !stats) {
        return <div className="text-center p-10 text-red-500">Error: {error || 'Failed to load dashboard stats.'}</div>;
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
            <p className="mt-1 text-gray-600">Overview of all registered files.</p>
            <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="Personal Files" 
                    total={stats.personal.total} 
                    weekly={stats.personal.weekly} 
                    active={stats.personal.active}
                    expired={stats.personal.expired}
                    icon={<UserIcon className="w-8 h-8" />} 
                    color="text-blue-500" 
                />
                <StatCard 
                    title="Family Files" 
                    total={stats.family.total} 
                    weekly={stats.family.weekly} 
                    active={stats.family.active}
                    expired={stats.family.expired}
                    icon={<UsersIcon className="w-8 h-8" />} 
                    color="text-green-500" 
                />
                <StatCard 
                    title="Referral Files" 
                    total={stats.referral.total} 
                    weekly={stats.referral.weekly} 
                    active={stats.referral.active}
                    expired={stats.referral.expired}
                    icon={<ShareIcon className="w-8 h-8" />} 
                    color="text-purple-500" 
                />
                <StatCard 
                    title="Emergency Files" 
                    total={stats.emergency.total} 
                    weekly={stats.emergency.weekly} 
                    active={stats.emergency.active}
                    expired={stats.emergency.expired}
                    icon={<ExclamationIcon className="w-8 h-8" />} 
                    color="text-red-500" 
                />
            </div>
        </div>
    );
};

const StatCard: React.FC<{ 
    title: string; 
    total: number; 
    weekly: number; 
    active: number;
    expired: number;
    icon: React.ReactNode; 
    color: string 
}> = ({ title, total, weekly, active, expired, icon, color }) => (
    <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow">
        <div className={`p-3 bg-gray-100 rounded-full w-max ${color}`}>
            {icon}
        </div>
        <div className="mt-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-green-50 rounded">
                    <p className="text-xs font-medium text-green-800">Active</p>
                    <p className="text-lg font-semibold text-green-600">{active}</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                    <p className="text-xs font-medium text-red-800">Expired</p>
                    <p className="text-lg font-semibold text-red-600">{expired}</p>
                </div>
            </div>
            <p className="mt-2 text-xs text-green-600">
                <span className="font-semibold">+{weekly}</span> this week
            </p>
        </div>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
    const [currentView, setCurrentView] = useState<View>(View.Dashboard);

    const renderContent = () => {
        switch (currentView) {
            case View.Dashboard:
                return <DashboardContent />;
            case View.Personal:
                return <PersonalFilesView />;
            case View.Family:
                return <FamilyFilesView />;
            case View.Referral:
                return <ReferralFilesView />;
            case View.Emergency:
                return <EmergencyFilesView />;
            default:
                return <DashboardContent />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
            <div className="flex flex-col flex-1">
                <Header onLogout={onLogout} />
                <main className="flex-1 p-6 overflow-y-auto">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

const Sidebar: React.FC<{ currentView: View; setCurrentView: (view: View) => void }> = ({ currentView, setCurrentView }) => {
    const navItems = [
        { view: View.Dashboard, label: 'Dashboard', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
        { view: View.Personal, label: 'Personal Files', icon: <UserIcon className="h-6 w-6" /> },
        { view: View.Family, label: 'Family Files', icon: <UsersIcon className="h-6 w-6" /> },
        { view: View.Referral, label: 'Referral Files', icon: <ShareIcon className="h-6 w-6" /> },
        { view: View.Emergency, label: 'Emergency Files', icon: <ExclamationIcon className="h-6 w-6" /> },
    ];
    
    return (
        <div className="flex flex-col w-64 bg-white shadow-lg">
            <div className="flex items-center justify-center h-20 border-b">
                 <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 text-sjmc-blue">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                         </svg>
                    </div>
                     <span className="text-xl font-bold text-sjmc-blue-dark">SJMC Files</span>
                 </div>
            </div>
            <nav className="flex-1 px-4 py-4">
                {navItems.map(item => (
                    <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={`flex items-center w-full px-4 py-2 mt-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
                            currentView === item.view
                                ? 'bg-sjmc-blue text-white'
                                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                        }`}
                    >
                        {item.icon}
                        <span className="ml-3">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

const Header: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
    <header className="flex items-center justify-between h-20 px-6 bg-white border-b">
        <div className="flex items-center">
            {/* Can add search or other header elements here */}
        </div>
        <div className="flex items-center">
            <button
                onClick={onLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-sjmc-blue rounded-md hover:bg-sjmc-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sjmc-blue-light"
            >
                Logout
            </button>
        </div>
    </header>
);

export default Dashboard;