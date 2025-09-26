import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth.ts';
import { principalApiService as apiService } from '../../services';
import type { TeacherComplaint, ComplaintAboutStudent } from '../../types.ts';
import Card from '../../components/ui/Card.tsx';
import Input from '../../components/ui/Input.tsx';
import { AlertTriangleIcon } from '../../components/icons/Icons.tsx';
import Button from '../../components/ui/Button.tsx';

const ComplaintsAboutTeachers: React.FC = () => {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState<TeacherComplaint[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!user?.branchId) return;
        setLoading(true);
        const data = await apiService.getComplaintsForBranch(user.branchId);
        setComplaints(data);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusChip = (status: 'Open' | 'Resolved by Student') => {
        return status === 'Open' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
    };

    if (loading) return <p>Loading complaints...</p>;

    return complaints.length === 0 ? (
        <p className="text-center text-text-secondary-dark p-8">There are no complaints from students to review.</p>
    ) : (
        <div className="space-y-4">
            {complaints.map((complaint) => (
                <details key={complaint.id} className="bg-slate-50 p-4 rounded-lg" open>
                    <summary className="cursor-pointer font-semibold text-text-primary-dark flex justify-between items-center">
                        <div>
                            {complaint.subject} -
                            {complaint.teacherName ? (<> <span className="font-normal"> against </span> {complaint.teacherName}</>) : (<span className="font-normal"> (General Complaint)</span>)}
                            <span className="font-normal"> by </span> {complaint.studentName}
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusChip(complaint.status)}`}>{complaint.status}</span>
                            <span className="text-sm font-normal text-text-secondary-dark">{new Date(complaint.submittedAt).toLocaleString()}</span>
                        </div>
                    </summary>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-sm text-text-primary-dark whitespace-pre-wrap">{complaint.complaintText}</p>
                    </div>
                </details>
            ))}
        </div>
    );
};

const ComplaintsAboutStudents: React.FC = () => {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState<ComplaintAboutStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchData = useCallback(async () => {
        if (!user?.branchId) return;
        setLoading(true);
        const data = await apiService.getComplaintsAboutStudentsByBranch(user.branchId);
        setComplaints(data.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredComplaints = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        
        const start = startDate ? new Date(startDate) : null;
        if(start) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : null;
        if(end) end.setHours(23, 59, 59, 999);

        return complaints.filter(c => {
            const matchesSearch = !searchTerm ||
                c.studentName.toLowerCase().includes(lowercasedTerm) ||
                c.raisedByName.toLowerCase().includes(lowercasedTerm) ||
                c.complaintText.toLowerCase().includes(lowercasedTerm);
            
            const complaintDate = new Date(c.submittedAt);
            const matchesDate = 
                (!start || complaintDate >= start) &&
                (!end || complaintDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [complaints, searchTerm, startDate, endDate]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
    };


    if (loading) return <p>Loading complaint log...</p>;

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 items-end">
                <Input
                    label="Search Keywords"
                    placeholder="Student, teacher, etc..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="md:col-span-2"
                />
                <Input
                    label="From Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                    label="To Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                />
                <Button variant="secondary" onClick={handleClearFilters}>Clear Filters</Button>
            </div>

            {filteredComplaints.length === 0 ? (
                <p className="text-center text-text-secondary-dark p-8">No complaints found matching your criteria.</p>
            ) : (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {filteredComplaints.map(complaint => (
                        <div key={complaint.id} className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-4">
                            <div className="flex-shrink-0 text-red-500 mt-1"><AlertTriangleIcon className="w-6 h-6" /></div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-red-800">
                                            Complaint against: <span className="text-brand-secondary">{complaint.studentName}</span>
                                        </p>
                                        <p className="text-xs text-red-700">
                                            By: {complaint.raisedByName} ({complaint.raisedByRole})
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-600">{new Date(complaint.submittedAt).toLocaleString()}</p>
                                </div>
                                <p className="mt-2 text-sm text-red-900 whitespace-pre-wrap">{complaint.complaintText}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const GrievanceOverview: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'aboutTeachers' | 'aboutStudents'>('aboutTeachers');

    const tabButtonClasses = (isActive: boolean) =>
        `px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${isActive ? 'bg-slate-200 rounded-t-lg font-semibold text-text-primary-dark' : 'text-text-secondary-dark hover:bg-slate-100'}`;

    return (
        <div>
            <h1 className="text-3xl font-bold text-text-primary-dark mb-6">Grievance Log</h1>
            <Card>
                <div className="flex border-b border-slate-200 mb-6">
                    <button className={tabButtonClasses(activeTab === 'aboutTeachers')} onClick={() => setActiveTab('aboutTeachers')}>Complaints About Teachers</button>
                    <button className={tabButtonClasses(activeTab === 'aboutStudents')} onClick={() => setActiveTab('aboutStudents')}>Complaints About Students (Discipline Log)</button>
                </div>
                {activeTab === 'aboutTeachers' && <ComplaintsAboutTeachers />}
                {activeTab === 'aboutStudents' && <ComplaintsAboutStudents />}
            </Card>
        </div>
    );
};

export default GrievanceOverview;