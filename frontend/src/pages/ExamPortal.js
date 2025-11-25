import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import laravelApi from '../services/laravelApi';
import offlineSync from '../services/offlineSync';
import { offlineDB } from '../services/offlineDB';

function ExamPortal() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(null);
  const [startedAt, setStartedAt] = useState(null);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  useEffect(() => {
    loadExam();
  }, [examId]);

  useEffect(() => {
    if (timeRemaining <= 0 || submitted) return;

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
  }, [timeRemaining, submitted]);

  const loadExam = async () => {
    try {
      setLoading(true);
      if (isOnline) {
        try {
          const res = await laravelApi.exams.load(examId);
          const examData = res.data.exam;
          setExam(examData);
          setQuestions(examData.questions || []);

          await offlineDB.saveExam(examData);
          const questionsWithExamId = (examData.questions || []).map(q => ({
            ...q,
            examId: examData.id
          }));
          await offlineDB.saveQuestions(questionsWithExamId);

          setTimeRemaining(examData.duration_minutes * 60);
          setStartedAt(new Date().toISOString());
        } catch (error) {
          console.warn('Failed to load from API, trying offline:', error);
          loadExamOffline();
        }
      } else {
        loadExamOffline();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadExamOffline = async () => {
    const cachedExam = await offlineDB.getExam(examId);
    if (cachedExam) {
      setExam(cachedExam);
      const cachedQuestions = await offlineDB.getQuestionsByExam(examId);
      setQuestions(cachedQuestions);
      setTimeRemaining(cachedExam.duration_minutes * 60);
      setStartedAt(new Date().toISOString());
    } else {
      alert('Exam not found. Please load it online first.');
      navigate('/student-dashboard');
    }
  };

  const handleSelectAnswer = (questionId, optionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
    autosaveAnswer(questionId, optionId);
  };

  const autosaveAnswer = async (questionId, optionId) => {
    try {
      const answer = {
        questionId,
        optionId,
        timestamp: new Date().toISOString()
      };
      await offlineDB.saveAnswer(answer);
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const handleSubmit = async () => {
    if (submitted) return;

    setSubmitted(true);
    setSyncStatus('Submitting...');

    const endedAt = new Date().toISOString();
    const answerList = Object.entries(answers).map(([questionId, optionId]) => ({
      question_id: parseInt(questionId),
      option_id: optionId
    }));

    try {
      const token = localStorage.getItem('auth_token');
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const studentId = decoded.sub || decoded.id;

      await offlineSync.queueAttempt(
        examId,
        studentId,
        answerList,
        startedAt,
        endedAt
      );

      if (isOnline) {
        setSyncStatus('Syncing to server...');
        const result = await offlineSync.syncAll();
        
        if (result.failed.length === 0) {
          setSyncStatus('Submitted successfully');
          setTimeout(() => navigate('/student-dashboard'), 2000);
        } else {
          setSyncStatus('Queued for later sync');
          setTimeout(() => navigate('/student-dashboard'), 2000);
        }
      } else {
        setSyncStatus('Offline - queued for sync');
        setTimeout(() => navigate('/student-dashboard'), 2000);
      }
    } catch (error) {
      setSyncStatus(`Error: ${error.message}`);
      console.error('Submit error:', error);
      setSubmitted(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="exam-portal loading">Loading exam...</div>;
  if (!exam) return <div className="exam-portal error">Exam not found</div>;

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="exam-portal">
      <header className="exam-header">
        <h1>{exam.title}</h1>
        <div className="exam-meta">
          <span className="timer">⏱️ {formatTime(timeRemaining)}</span>
          <span className={`status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
          {syncStatus && <span className="sync-status">{syncStatus}</span>}
        </div>
      </header>

      {submitted && (
        <div className="submission-message success">
          ✓ {syncStatus}
        </div>
      )}

      <div className="exam-content">
        <aside className="question-navigator">
          <h3>Questions ({questions.length})</h3>
          <div className="question-list">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                className={`question-btn ${currentQuestionIndex === idx ? 'active' : ''} ${
                  answers[q.id] ? 'answered' : ''
                }`}
                onClick={() => setCurrentQuestionIndex(idx)}
              >
                {idx + 1}
                {answers[q.id] && ' ✓'}
              </button>
            ))}
          </div>
        </aside>

        <main className="question-content">
          {currentQuestion && (
            <div className="question-card">
              <h3>Question {currentQuestionIndex + 1}</h3>
              <p className="question-text">{currentQuestion.question_text}</p>

              <div className="options">
                {currentQuestion.options && currentQuestion.options.map(option => (
                  <label key={option.id} className="option">
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option.id}
                      checked={answers[currentQuestion.id] === option.id}
                      onChange={() => handleSelectAnswer(currentQuestion.id, option.id)}
                      disabled={submitted}
                    />
                    <span>{option.option_text}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="navigation-buttons">
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              ← Previous
            </button>
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next →
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitted}
            className="submit-btn"
          >
            {submitted ? 'Submitted' : 'Submit Exam'}
          </button>
        </main>
      </div>
    </div>
  );
}

export default ExamPortal;
