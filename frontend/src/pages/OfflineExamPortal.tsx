/* eslint-disable react/forbid-dom-props */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Timer } from '../components';
import { getCurrentStudentProfile } from './student/studentData';
import { showError, showSuccess, showWarning } from '../utils/alerts';
import { useCheatingDetection, CheatingEvent } from '../hooks/useCheatingDetection';
import { useOfflineExam, OfflineAnswerInput } from '../hooks/useOfflineExam';
import useConnectivity from '../hooks/useConnectivity';
import { getReachableBaseUrl } from '../services/reachability';
import offlineDB from '../services/offlineDB';
import syncService from '../services/syncService';

interface Question {
  id: number;
  question_text: string;
  options: QuestionOption[];
}

interface QuestionOption {
  id: number;
  option_text: string;
}

interface Exam {
  id: number;
  title: string;
  duration_minutes: number;
  questions: Question[];
}

interface ExamPackagePayload {
  examId: number;
  packageVersion?: string;
  exam: Exam;
  questions?: Question[];
}

const OfflineExamPortal: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const preferredAttemptId = query.get('attemptId');
  const preferredStudentId = query.get('studentId');
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [examStartTime] = useState(new Date().toISOString());
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(preferredStudentId ? Number(preferredStudentId) : null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const examIdNum = parseInt(examId || '0');
  
  const connectivity = useConnectivity();

  // Offline exam hook
  const {
    examPackage,
    attempt,
    pendingSync,
    loadExamPackage,
    storeExamPackage,
    getOrCreateAttempt,
    saveAnswer,
    submitAttempt,
    loadAnswers,
  } = useOfflineExam(examIdNum, studentId, preferredAttemptId);
  
  // Cheating detection
  const {
    violations,
    violationCount,
    isFullscreen,
    requestFullscreen,
  } = useCheatingDetection({
    attemptId: attempt?.attemptId,
    enableTabSwitchDetection: true,
    enableCopyPasteDetection: true,
    enableRightClickBlock: true,
    enableDevToolsDetection: true,
    enableFullscreenEnforcement: true,
    enableMultipleTabDetection: true,
    maxViolations: 10,
    onViolation: (event: CheatingEvent) => {
      console.warn('Cheating violation detected:', event);
      if (violationCount >= 5) {
        setShowViolationWarning(true);
      }
    },
    onMaxViolationsReached: () => {
      showError('Maximum violations reached. Exam will be submitted automatically.');
      setTimeout(() => handleSubmit(), 3000);
    },
  });

  // Load exam data
  useEffect(() => {
    loadExamFromSourceOrCache();
  }, [examId, connectivity.status, studentId, preferredAttemptId]);

  useEffect(() => {
    const loadStudentId = async () => {
      if (preferredStudentId && Number(preferredStudentId) > 0) {
        setStudentId(Number(preferredStudentId));
        localStorage.setItem('student_id', String(preferredStudentId));
        return;
      }

      const cached = localStorage.getItem('student_id');
      if (cached) {
        setStudentId(Number(cached));
        return;
      }

      if (connectivity.status === 'OFFLINE') {
        return;
      }

      try {
        const student = await getCurrentStudentProfile();
        if (student?.id) {
          localStorage.setItem('student_id', String(student.id));
          setStudentId(student.id);
        }
      } catch {
        setStudentId(null);
      }
    };

    loadStudentId();
  }, [connectivity.status, preferredStudentId]);

  useEffect(() => {
    const loadSyncMeta = async () => {
      const lastSync = await offlineDB.meta.get('lastSyncTime');
      const lastError = await offlineDB.meta.get('lastSyncError');
      setLastSyncTime(lastSync?.value || null);
      setLastSyncError(lastError?.value || null);
    };

    loadSyncMeta();
    const interval = window.setInterval(loadSyncMeta, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const loadExamFromSourceOrCache = async () => {
    try {
      setLoading(true);
      const baseUrl = getReachableBaseUrl(connectivity);

      if (baseUrl) {
        const response = await fetch(`${baseUrl}/exams/${examId}/package`, { cache: 'no-store' });
        if (response.ok) {
          const payload: ExamPackagePayload = await response.json();
          const examData = payload.exam || (payload as any).data?.exam;
          const questions = payload.questions || examData?.questions || (payload as any).data?.questions || [];
          const pkg = {
            examId: examIdNum,
            downloadedAt: new Date().toISOString(),
            packageVersion: String(payload.packageVersion || (payload as any).package_version || '1'),
            data: {
              exam: examData,
              questions,
            },
          };

          await storeExamPackage(pkg);
        }
      }

      const cached = await loadExamPackage();
      if (cached) {
        const pkgData = cached.data || {};
        const examInfo = pkgData.exam || pkgData;
        const questions = pkgData.questions || examInfo?.questions || [];

        setExam({
          ...examInfo,
          questions,
        });
        setTimeRemaining((examInfo?.duration_minutes || 0) * 60);

        const currentAttempt = await getOrCreateAttempt();
        if (currentAttempt) {
          const storedAnswers = await loadAnswers();
          const answerMap: Record<number, number> = {};
          storedAnswers.forEach((answer) => {
            if (answer.answer?.optionId) {
              answerMap[answer.questionId] = answer.answer.optionId;
            }
          });
          setAnswers(answerMap);
        }

        if (connectivity.status === 'OFFLINE') {
          showWarning('You are offline. Answers will sync when connection is restored.');
        }
      } else {
        showError('Exam package not available offline. Please connect to download it.');
        navigate('/cbt');
      }
    } catch (error) {
      console.error('Failed to load exam:', error);
      showError('Failed to load exam package.');
      navigate('/cbt');
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!exam || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam, timeRemaining]);

  // Enter fullscreen on mount
  useEffect(() => {
    if (!isFullscreen) {
      requestFullscreen();
    }
  }, []);

  // Handle answer selection
  const handleAnswerSelect = async (questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    
    // Save answer offline
    const answer: OfflineAnswerInput = {
      questionId,
      answer: { optionId },
    };

    await saveAnswer(answer);
  };

  // Navigate questions
  const goToQuestion = (index: number) => {
    if (index >= 0 && exam && index < exam.questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  // Submit exam
  const handleSubmit = async () => {
    if (!exam) return;

    setShowSubmitModal(false);

    try {
      const submitted = await submitAttempt();
      const pending = await syncService.pendingCount();
      showSuccess(`Submitted locally. Receipt: ${submitted?.receiptCode || 'N/A'}. Pending sync: ${pending}`);
      navigate('/student/exams');
    } catch (error) {
      console.error('Submission error:', error);
      showWarning('Submission saved locally. Will retry sync when reachable.');
      navigate('/student/exams');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <p className="text-red-600">Failed to load exam</p>
        </Card>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / exam.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Connection Status */}
      <div className="fixed top-4 right-4 z-50">
        {connectivity.status === 'OFFLINE' && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <i className='bx bx-wifi-off'></i>
            <span className="font-medium">Offline Mode</span>
          </div>
        )}
        {connectivity.status === 'LAN_ONLY' && (
          <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <i className='bx bx-wifi'></i>
            <span className="font-medium">LAN Only</span>
          </div>
        )}
        {connectivity.status === 'ONLINE' && (
          <div className="bg-emerald-100 border border-emerald-400 text-emerald-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <i className='bx bx-cloud'></i>
            <span className="font-medium">Online</span>
          </div>
        )}
        {pendingSync > 0 && (
          <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mt-2">
            <i className='bx bx-sync'></i>
            <span>{pendingSync} pending sync(s)</span>
          </div>
        )}
        {lastSyncTime && (
          <div className="bg-slate-100 border border-slate-300 text-slate-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mt-2">
            <i className='bx bx-time'></i>
            <span>Last sync: {new Date(lastSyncTime).toLocaleString()}</span>
          </div>
        )}
        {lastSyncError && (
          <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 mt-2">
            <i className='bx bx-error'></i>
            <span>Sync error: {lastSyncError}</span>
          </div>
        )}
      </div>

      {/* Violation Warning */}
      {showViolationWarning && violationCount >= 5 && (
        <div className="fixed top-20 right-4 z-50 bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start gap-2">
            <i className='bx bx-error text-2xl'></i>
            <div>
              <h4 className="font-bold">Warning!</h4>
              <p className="text-sm">{violationCount} violations detected. Exam may be flagged for review.</p>
            </div>
            <button 
              onClick={() => setShowViolationWarning(false)} 
              className="ml-auto"
              title="Close warning"
              aria-label="Close warning"
            >
              <i className='bx bx-x text-xl'></i>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-4">
        <Card>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{exam.title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Question {currentQuestionIndex + 1} of {exam.questions.length}
              </p>
            </div>
            <div className="text-right">
              <Timer timeRemaining={timeRemaining} duration={exam.duration_minutes * 60} />
              {violationCount > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {violationCount} violation(s) detected
                </p>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{answeredCount} / {exam.questions.length} answered</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all absolute top-0 left-0"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Question */}
      <div className="max-w-4xl mx-auto">
        <Card>
          <h2 className="text-lg font-semibold mb-4">
            {currentQuestion.question_text}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => (
              <div
                key={option.id}
                onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  answers[currentQuestion.id] === option.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    answers[currentQuestion.id] === option.id
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-400'
                  }`}>
                    {answers[currentQuestion.id] === option.id && (
                      <i className='bx bx-check text-white text-sm'></i>
                    )}
                  </div>
                  <span>{option.option_text}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-6 pt-6 border-t">
            <Button
              onClick={() => goToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              variant="secondary"
            >
              <i className='bx bx-chevron-left'></i>
              Previous
            </Button>

            {currentQuestionIndex === exam.questions.length - 1 ? (
              <Button onClick={() => setShowSubmitModal(true)}>
                Submit Exam
              </Button>
            ) : (
              <Button onClick={() => goToQuestion(currentQuestionIndex + 1)}>
                Next
                <i className='bx bx-chevron-right'></i>
              </Button>
            )}
          </div>
        </Card>

        {/* Question Navigator */}
        <Card className="mt-4">
          <h3 className="font-semibold mb-3">Question Navigator</h3>
          <div className="grid grid-cols-10 gap-2">
            {exam.questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => goToQuestion(index)}
                className={`w-10 h-10 rounded-lg font-medium ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : answers[q.id]
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md">
            <h3 className="text-xl font-bold mb-4">Submit Exam?</h3>
            <p className="mb-4">
              You have answered {answeredCount} out of {exam.questions.length} questions.
              {answeredCount < exam.questions.length && (
                <span className="text-red-600 block mt-2">
                  Warning: {exam.questions.length - answeredCount} question(s) unanswered!
                </span>
              )}
            </p>
            {violationCount > 0 && (
              <p className="text-orange-600 mb-4">
                Note: {violationCount} violation(s) will be recorded with your submission.
              </p>
            )}
            {connectivity.status === 'OFFLINE' && (
              <p className="text-yellow-600 mb-4">
                You are offline. Exam will be submitted when connection is restored.
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={() => setShowSubmitModal(false)} variant="secondary" fullWidth>
                Cancel
              </Button>
              <Button onClick={handleSubmit} fullWidth>
                Confirm Submit
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OfflineExamPortal;
