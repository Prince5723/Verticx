import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth.ts';
// FIX: Corrected import to use teacherApiService aliased as apiService.
import { TeacherApiService } from "../../services";
const apiService = new TeacherApiService();
import type { TeacherCourse, MarkingTemplate, Student, StudentMark, Course } from '../../types.ts';
import Card from '../../components/ui/Card.tsx';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import ConfirmationModal from '../../components/ui/ConfirmationModal.tsx';

const TemplateFormModal: React.FC<{
    courseId: string;
    onClose: () => void;
    onSave: () => void;
}> = ({ courseId, onClose, onSave }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [totalMarks, setTotalMarks] = useState(100);
    const [weightage, setWeightage] = useState(20);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSaving(true);
// FIX: Called the correct 'createMarkingTemplate' method on apiService.
        await apiService.createMarkingTemplate({
            teacherId: user.id,
            courseId,
            name,
            totalMarks,
            weightage
        } as Omit<MarkingTemplate, 'id'>);
        setIsSaving(false);
        onSave();
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg">
                <h2 className="text-xl font-bold mb-4">Create Marking Template</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Template Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Midterm Exam" required />
                    <Input label="Total Marks" type="number" value={String(totalMarks)} onChange={e => setTotalMarks(Number(e.target.value))} required min="1" />
                    <Input label="Weightage (%)" type="number" value={String(weightage)} onChange={e => setWeightage(Number(e.target.value))} required min="1" max="100" />
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Create Template'}</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};


const Gradebook: React.FC = () => {
    const { user } = useAuth();
    const [courses, setCourses] = useState<TeacherCourse[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [activeTab, setActiveTab] = useState<'templates' | 'marks'>('templates');

    // Templates state
    const [templates, setTemplates] = useState<MarkingTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [deletingTemplate, setDeletingTemplate] = useState<MarkingTemplate | null>(null);
    const [realCourseId, setRealCourseId] = useState('');


    // Marks Entry state
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [marks, setMarks] = useState<Record<string, number | undefined>>({}); // studentId -> marks
    const [loadingMarks, setLoadingMarks] = useState(false);
    const [isSavingMarks, setIsSavingMarks] = useState(false);

    const fetchCourses = useCallback(async () => {
        if (!user) return;
// FIX: Called the correct 'getTeacherCourses' method on apiService.
        const data = await apiService.getTeacherCourses(user.id);
        setCourses(data);
        if (data.length > 0) {
            setSelectedCourseId(data[0].id);
        }
    }, [user]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    const fetchTemplates = useCallback(async () => {
        if (!selectedCourseId || !user) {
            setRealCourseId('');
            setTemplates([]);
            return;
        }
        setLoadingTemplates(true);
        const [, subjectId] = selectedCourseId.split('|');
// FIX: Called the correct 'getCoursesByBranch' method on apiService.
        const course = (await apiService.getCoursesByBranch(user!.branchId!)).find(c => c.subjectId === subjectId && c.teacherId === user!.id);
        
        if (course) {
            setRealCourseId(course.id);
// FIX: Called the correct 'getMarkingTemplatesForCourse' method on apiService.
            const data = await apiService.getMarkingTemplatesForCourse(course.id);
            setTemplates(data);
            if(data.length > 0) {
              setSelectedTemplateId(data[0].id);
            } else {
              setSelectedTemplateId('');
            }
        } else {
            setRealCourseId('');
            setTemplates([]);
        }
        setLoadingTemplates(false);
    }, [selectedCourseId, user]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const fetchStudentsAndMarks = useCallback(async () => {
        if (!selectedTemplateId || !selectedCourseId) {
            setStudents([]);
            setMarks({});
            return;
        }
        setLoadingMarks(true);
        
        const [classId] = selectedCourseId.split('|');
        const studentData = await apiService.getStudentsForClass(classId);
        setStudents(studentData);

// FIX: Called the correct 'getStudentMarksForTemplate' method on apiService.
        const marksData = await apiService.getStudentMarksForTemplate(selectedTemplateId);
        const marksMap = marksData.reduce((acc, mark) => {
            acc[mark.studentId] = mark.marksObtained;
            return acc;
        }, {} as Record<string, number>);
        setMarks(marksMap);
        
        setLoadingMarks(false);
    }, [selectedTemplateId, selectedCourseId]);

    useEffect(() => {
        fetchStudentsAndMarks();
    }, [fetchStudentsAndMarks]);

    const handleMarkChange = (studentId: string, value: string) => {
        const numValue = value === '' ? undefined : Number(value);
        setMarks(prev => ({ ...prev, [studentId]: numValue }));
    };

    const handleSaveMarks = async () => {
        if (!selectedTemplateId) return;
        setIsSavingMarks(true);
        const marksToSave = Object.entries(marks)
            .filter(([, value]) => value !== undefined)
            // FIX: The type inference for 'marksObtained' was resulting in 'unknown'.
            // Casting to 'number' after filtering out undefined values resolves the type error.
            .map(([studentId, marksObtained]) => ({ studentId, marksObtained: marksObtained as number }));
// FIX: Called the correct 'saveStudentMarks' method on apiService.
        await apiService.saveStudentMarks(selectedTemplateId, marksToSave);
        setIsSavingMarks(false);
        fetchStudentsAndMarks(); // Refresh
    };
    
    const handleDeleteTemplate = async () => {
        if (!deletingTemplate) return;
// FIX: Called the correct 'deleteMarkingTemplate' method on apiService.
        await apiService.deleteMarkingTemplate(deletingTemplate.id);
        setDeletingTemplate(null);
        fetchTemplates();
    };

    const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId), [templates, selectedTemplateId]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-text-primary-dark mb-6">Gradebook</h1>
            <Card>
                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                     <div>
                        <label className="block text-sm font-medium text-text-secondary-dark mb-1">Course</label>
                        <select
                            value={selectedCourseId}
                            onChange={e => setSelectedCourseId(e.target.value)}
                            className="bg-surface-dark border border-slate-300 rounded-md py-2 px-3 w-72"
                        >
                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="flex border-b mb-4">
                    <button onClick={() => setActiveTab('templates')} className={`px-4 py-2 ${activeTab === 'templates' ? 'border-b-2 border-brand-primary' : ''}`}>Manage Templates</button>
                    <button onClick={() => setActiveTab('marks')} className={`px-4 py-2 ${activeTab === 'marks' ? 'border-b-2 border-brand-primary' : ''}`}>Enter Marks</button>
                </div>

                {activeTab === 'templates' && (
                    <div>
                        <Button onClick={() => setShowTemplateModal(true)} disabled={!realCourseId}>Create New Template</Button>
                        <div className="mt-4 space-y-2">
                            {loadingTemplates ? <p>Loading...</p> : templates.map(t => (
                                <div key={t.id} className="bg-slate-50 p-3 rounded flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{t.name}</p>
                                        <p className="text-sm text-slate-600">Total Marks: {t.totalMarks}, Weightage: {t.weightage}%</p>
                                    </div>
                                    <Button variant="danger" onClick={() => setDeletingTemplate(t)}>Delete</Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'marks' && (
                    <div>
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary-dark mb-1">Select Template</label>
                                <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="bg-surface-dark border border-slate-300 rounded-md py-2 px-3 w-72">
                                    <option value="">-- Select a template --</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <Button onClick={handleSaveMarks} disabled={isSavingMarks}>
                                {isSavingMarks ? 'Saving...' : 'Save Marks'}
                            </Button>
                        </div>

                        {loadingMarks ? <p>Loading students...</p> : selectedTemplate && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b">
                                        <tr>
                                            <th className="p-2">Student Name</th>
                                            <th className="p-2">Marks Obtained</th>
                                            <th className="p-2">Weighted Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map(s => {
                                            const marksObtained = marks[s.id];
                                            const weightedScore = (marksObtained !== undefined && selectedTemplate)
                                                ? (marksObtained / selectedTemplate.totalMarks) * selectedTemplate.weightage
                                                : null;

                                            return (
                                                <tr key={s.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-2">{s.name}</td>
                                                    <td className="p-2">
                                                        <Input type="number" value={marksObtained ?? ''} onChange={e => handleMarkChange(s.id, e.target.value)} className="w-32" placeholder={`/ ${selectedTemplate.totalMarks}`} />
                                                    </td>
                                                    <td className="p-2 font-semibold">
                                                        {weightedScore !== null ? `${weightedScore.toFixed(2)} / ${selectedTemplate.weightage}` : 'N/A'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {showTemplateModal && realCourseId && (
                <TemplateFormModal
                    courseId={realCourseId}
                    onClose={() => setShowTemplateModal(false)}
                    onSave={() => { setShowTemplateModal(false); fetchTemplates(); }}
                />
            )}
            
            {deletingTemplate && (
                <ConfirmationModal 
                    isOpen={!!deletingTemplate}
                    onClose={() => setDeletingTemplate(null)}
                    onConfirm={handleDeleteTemplate}
                    title="Delete Template"
                    message={`Are you sure you want to delete the template "${deletingTemplate.name}"? All associated marks will also be deleted.`}
                />
            )}
        </div>
    );
};

export default Gradebook;
