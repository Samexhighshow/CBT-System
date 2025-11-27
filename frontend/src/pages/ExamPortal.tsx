import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Timer } from '../components';

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

const ExamPortal: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600); // 60 minutes in seconds
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExam();
  }, [examId]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const loadExam = () => {
    // Simulate loading exam
    setTimeout(() => {
      setExam({
        id: parseInt(examId || '1'),
        title: 'Mathematics Mid-Term Exam',
        duration_minutes: 60,
        questions: [
          {
            id: 1,
            question_text: 'What is 15 + 27?',
            options: [
              { id: 1, option_text: '42', is_correct: true },
              { id: 2, option_text: '41' },
              { id: 3, option_text: '43' },
              { id: 4, option_text: '44' }
            ]
          },
          {
            id: 2,
            question_text: 'Solve: 8 × 7 = ?',
            options: [
              { id: 5, option_text: '54' },
              { id: 6, option_text: '56', is_correct: true },
              { id: 7, option_text: '58' },
              { id: 8, option_text: '60' }
            ]
          },
          {
            id: 3,
            question_text: 'What is the square root of 144?',
            options: [
              { id: 9, option_text: '11' },
              { id: 10, option_text: '12', is_correct: true },
              { id: 11, option_text: '13' },
              { id: 12, option_text: '14' }
            ]
          }
        ]
      });
      setLoading(false);
    }, 1000);
  };

  const handleSelectAnswer = (questionId: number, optionId: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
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

  const handleSubmit = () => {
    // Submit exam
    const score = exam?.questions.reduce((acc, question) => {
      const selectedOption = question.options.find(opt => opt.id === answers[question.id]);
      return selectedOption?.is_correct ? acc + 1 : acc;
    }, 0) || 0;

    alert(`Exam submitted! Your score: ${score}/${exam?.questions.length || 0}`);
    navigate('/dashboard');
  };

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
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
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
