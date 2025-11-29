import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Timer } from '../components';
import { api } from '../services/api';
import Dexie from 'dexie';
import { showError, showSuccess } from '../utils/alerts';

interface Question {
  id: number;
  question_text: string;
  options: QuestionOption[];
}

interface QuestionOption {
  id: number;
  option_text: string;
  is_correct?: boolean;
}

interface Exam {
  id: number;
  title: string;
  duration_minutes: number;
  questions: Question[];
}

// IndexedDB setup for offline answer storage
class ExamDB extends Dexie {
  answers!: Dexie.Table<{ id?: number; examId: number; questionId: number; answerId: number; updatedAt: number }, number>;
  constructor() {
    super('ExamDB');
    this.version(1).stores({ answers: '++id,examId,questionId,updatedAt' });
  }
}
const examDB = new ExamDB();

const ExamPortal: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600); // default 60 minutes in seconds
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const syncLock = useRef(false);

  const loadExam = React.useCallback(async () => {
    try {
      setLoading(true);
      const examRes = await api.get(`/exams/${examId}`);
      const questionsRes = await api.get(`/exams/${examId}/questions`);
      const examData: Exam = {
        id: Number(examId),
        title: examRes.data?.title,
        duration_minutes: examRes.data?.duration || examRes.data?.duration_minutes || 60,
        questions: (questionsRes.data || []).map((q: any) => ({
          id: q.id,
          question_text: q.question_text || q.text,
          options: (q.options || []).map((o: any) => ({ id: o.id, option_text: o.option_text || o.text }))
        }))
      };
      setExam(examData);
      setTimeRemaining(examData.duration_minutes * 60);
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      const errorMsg = e?.response?.data?.message || 'Failed to load exam.';
      
      // Show specific error messages for restrictions
      if (errorMsg.includes('daily window') || errorMsg.includes('restricted to')) {
        await showError(errorMsg + ' Please try again during the allowed time.');
      } else if (errorMsg.includes('Maximum allowed attempts')) {
        await showError(errorMsg);
      } else if (errorMsg.includes('not within the scheduled')) {
        await showError('This exam is not currently available. Please check the exam schedule.');
      } else {
        await showError(errorMsg);
      }
      
      setLoading(false);
      // Redirect back to student dashboard
      setTimeout(() => navigate('/student'), 3000);
    }
  }, [examId, navigate]);

  const handleSubmit = React.useCallback(() => {
    // Sync local answers then submit
    (async () => {
      try {
        await syncAnswers();
        showSuccess('Exam submitted!');
        navigate('/student');
      } catch (e) {
        showError('Submission failed. Answers remain saved locally and will sync.');
      }
    })();
  }, [exam, answers, navigate]);

  const handleSelectAnswer = (questionId: number, optionId: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
    // Save locally for offline resilience
    examDB.answers.put({ examId: Number(examId), questionId, answerId: optionId, updatedAt: Date.now() });
  };

  const handleNext = () => {
    if (exam && currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    loadExam();
  }, [loadExam]);
  // periodic sync to backend
  useEffect(() => {
    const iv = setInterval(() => {
      syncAnswers();
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const syncAnswers = async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    try {
      const pending = await examDB.answers.where('examId').equals(Number(examId)).toArray();
      if (pending.length === 0) return;
      await api.post(`/exams/${examId}/submit`, {
        answers: pending.map(p => ({ question_id: p.questionId, option_id: p.answerId }))
      });
      await examDB.answers.where('examId').equals(Number(examId)).delete();
    } catch (e) {
      // keep local; retry later
    } finally {
      syncLock.current = false;
    }
  };

  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, handleSubmit]);

  if (loading || !exam) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {exam.questions.length}
              </p>
            </div>
            <div className="text-right">
              <Timer timeRemaining={timeRemaining} duration={exam.duration_minutes * 60} />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                   style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Area */}
          <div className="lg:col-span-3">
            <Card>
              <div className="mb-6">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                    {currentQuestionIndex + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-lg text-gray-900">{currentQuestion.question_text}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelectAnswer(currentQuestion.id, option.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      answers[currentQuestion.id] === option.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm ${
                      answers[currentQuestion.id] === option.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-600'
                    }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-gray-900">{option.option_text}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <Button
                  variant="secondary"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                >
                  ← Previous
                </Button>

                {currentQuestionIndex === exam.questions.length - 1 ? (
                  <Button
                    variant="success"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Submit Exam
                  </Button>
                ) : (
                  <Button onClick={handleNext}>
                    Next →
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Question Navigator */}
          <div className="lg:col-span-1">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Question Navigator</h3>
              <p className="text-sm text-gray-600 mb-4">
                {answeredCount} of {exam.questions.length} answered
              </p>
              <div className="grid grid-cols-5 gap-2">
                {exam.questions.map((question, index) => (
                  <button
                    key={question.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : answers[question.id]
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-gray-600">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-600"></div>
                  <span className="text-gray-600">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-200"></div>
                  <span className="text-gray-600">Not Answered</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Modal */}
      <Modal
        isOpen={showSubmitModal}
        title="Submit Exam"
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        confirmText="Submit"
        cancelText="Cancel"
      >
        <p className="text-gray-700">
          You have answered {answeredCount} out of {exam.questions.length} questions.
        </p>
        <p className="text-gray-700 mt-2">
          Are you sure you want to submit your exam? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default ExamPortal;
