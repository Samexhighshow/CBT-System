import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input, Alert } from '../../components';
import { showSuccess, showError, showConfirm } from '../../utils/alerts';
import { examApi } from '../../services/laravelApi';

interface QuestionRandomizationProps {
  examId: number;
  onClose: () => void;
}

interface RandomizationSettings {
  question_selection_mode: 'fixed' | 'random';
  total_questions_to_serve: number | null;
  shuffle_question_order: boolean;
  shuffle_option_order: boolean;
  question_distribution: 'same_for_all' | 'unique_per_student';
  difficulty_distribution: { easy?: number; medium?: number; hard?: number } | null;
  marks_distribution: { [key: number]: number } | null;
  topic_filters: string[] | null;
  question_reuse_policy: 'allow_reuse' | 'no_reuse_until_exhausted';
  questions_locked: boolean;
  questions_locked_at: string | null;
}

interface Preview {
  total_available: number;
  total_to_serve: number;
  total_marks: number;
  distribution: {
    by_difficulty: { easy: number; medium: number; hard: number };
    by_marks: { [key: number]: number };
    by_type: { [key: string]: number };
  };
  sample_questions: Array<{
    id: number;
    text: string;
    type: string;
    marks: number;
    difficulty: string;
  }>;
  errors: string[];
  warnings: string[];
  is_valid: boolean;
}

interface Stats {
  exam_id: number;
  total_questions: number;
  active_questions: number;
  selections_generated: number;
  questions_locked: boolean;
  locked_at: string | null;
  settings: {
    selection_mode: 'fixed' | 'random';
    total_to_serve: number | null;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    distribution_mode: 'same_for_all' | 'unique_per_student';
    difficulty_distribution: { easy?: number; medium?: number; hard?: number } | null;
    marks_distribution: { [key: number]: number } | null;
    topic_filters: string[] | null;
    reuse_policy: 'allow_reuse' | 'no_reuse_until_exhausted';
  };
  available_questions: {
    by_difficulty: { [key: string]: number };
    by_marks: { [key: number]: number };
  };
}

const QuestionRandomization: React.FC<QuestionRandomizationProps> = ({ examId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<RandomizationSettings>({
    question_selection_mode: 'fixed',
    total_questions_to_serve: null,
    shuffle_question_order: false,
    shuffle_option_order: false,
    question_distribution: 'same_for_all',
    difficulty_distribution: null,
    marks_distribution: null,
    topic_filters: null,
    question_reuse_policy: 'allow_reuse',
    questions_locked: false,
    questions_locked_at: null,
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'preview' | 'stats'>('settings');

  // Difficulty distribution form
  const [easyCount, setEasyCount] = useState<number>(0);
  const [mediumCount, setMediumCount] = useState<number>(0);
  const [hardCount, setHardCount] = useState<number>(0);
  const [useDifficultyDistribution, setUseDifficultyDistribution] = useState(false);

  // Marks distribution form
  const [marksDistribution, setMarksDistribution] = useState<Array<{ marks: number; count: number }>>([]);
  const [useMarksDistribution, setUseMarksDistribution] = useState(false);

  useEffect(() => {
    loadStats();
  }, [examId]);

  useEffect(() => {
    if (stats && stats.settings) {
      // Map backend response format to internal state format
      const backendSettings = stats.settings;
      
      setSettings({
        question_selection_mode: backendSettings.selection_mode || 'fixed',
        total_questions_to_serve: backendSettings.total_to_serve || null,
        shuffle_question_order: backendSettings.shuffle_questions || false,
        shuffle_option_order: backendSettings.shuffle_options || false,
        question_distribution: backendSettings.distribution_mode || 'same_for_all',
        difficulty_distribution: backendSettings.difficulty_distribution || null,
        marks_distribution: backendSettings.marks_distribution || null,
        topic_filters: backendSettings.topic_filters || null,
        question_reuse_policy: backendSettings.reuse_policy || 'allow_reuse',
        questions_locked: stats.questions_locked || false,
        questions_locked_at: stats.locked_at || null,
      });
      
      // Load difficulty distribution
      if (backendSettings.difficulty_distribution) {
        setUseDifficultyDistribution(true);
        setEasyCount(backendSettings.difficulty_distribution.easy || 0);
        setMediumCount(backendSettings.difficulty_distribution.medium || 0);
        setHardCount(backendSettings.difficulty_distribution.hard || 0);
      } else {
        setUseDifficultyDistribution(false);
        setEasyCount(0);
        setMediumCount(0);
        setHardCount(0);
      }

      // Load marks distribution
      if (backendSettings.marks_distribution && typeof backendSettings.marks_distribution === 'object') {
        setUseMarksDistribution(true);
        const marksArray = Object.entries(backendSettings.marks_distribution).map(([marks, count]) => ({
          marks: parseInt(marks),
          count: count as number,
        }));
        setMarksDistribution(marksArray);
      } else {
        setUseMarksDistribution(false);
        setMarksDistribution([]);
      }
    }
  }, [stats]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await examApi.getRandomizationStats(examId);
      // Handle both nested (data.data) and direct response formats
      const statsData = res.data.data || res.data;
      console.log('Loaded stats:', statsData); // Debug log
      setStats(statsData);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to load randomization stats');
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);

      // Build payload
      const payload: any = {
        question_selection_mode: settings.question_selection_mode,
        total_questions_to_serve: settings.total_questions_to_serve,
        shuffle_question_order: settings.shuffle_question_order,
        shuffle_option_order: settings.shuffle_option_order,
        question_distribution: settings.question_distribution,
        question_reuse_policy: settings.question_reuse_policy,
        topic_filters: settings.topic_filters,
      };

      // Add difficulty distribution if enabled
      if (useDifficultyDistribution && settings.question_selection_mode === 'random') {
        payload.difficulty_distribution = {
          easy: easyCount,
          medium: mediumCount,
          hard: hardCount,
        };
        payload.total_questions_to_serve = easyCount + mediumCount + hardCount;
      } else {
        payload.difficulty_distribution = null;
      }

      // Add marks distribution if enabled
      if (useMarksDistribution && settings.question_selection_mode === 'random') {
        const marksObj: { [key: number]: number } = {};
        let total = 0;
        marksDistribution.forEach(item => {
          marksObj[item.marks] = item.count;
          total += item.count;
        });
        payload.marks_distribution = marksObj;
        payload.total_questions_to_serve = total;
      } else {
        payload.marks_distribution = null;
      }

      const res = await examApi.updateRandomizationSettings(examId, payload);
      const savedStats = res.data.data || res.data;
      
      // Update state directly with returned data
      setStats(savedStats);
      
      showSuccess('Randomization settings saved successfully');
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to save settings');
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    try {
      setLoading(true);
      const res = await examApi.previewRandomization(examId);
      setPreview(res.data.data || res.data);
      setActiveTab('preview');
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleLockQuestions = async () => {
    const confirmed = await showConfirm(
      'Lock Questions?',
      'This will freeze the question selection. Students will receive their assigned questions based on current settings. This action requires unlocking to modify.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      await examApi.lockQuestions(examId);
      showSuccess('Questions locked successfully');
      // Reload stats to get updated lock status
      await loadStats();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to lock questions');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockQuestions = async () => {
    const confirmed = await showConfirm(
      'Unlock Questions?',
      'This will allow modifications to randomization settings. All existing student selections will be deleted and regenerated.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      await examApi.unlockQuestions(examId);
      showSuccess('Questions unlocked successfully');
      // Reload stats to get updated lock status
      await loadStats();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to unlock questions');
    } finally {
      setLoading(false);
    }
  };

  const addMarksEntry = () => {
    setMarksDistribution([...marksDistribution, { marks: 1, count: 1 }]);
  };

  const removeMarksEntry = (index: number) => {
    setMarksDistribution(marksDistribution.filter((_, i) => i !== index));
  };

  const updateMarksEntry = (index: number, field: 'marks' | 'count', value: number) => {
    const updated = [...marksDistribution];
    updated[index][field] = value;
    setMarksDistribution(updated);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Question Randomization & Selection" size="xl">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'settings'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'preview'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'stats'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
        </div>

        {/* Lock Status */}
        {settings.questions_locked && (
          <Alert
            type="warning"
            message={`Questions are locked since ${new Date(settings.questions_locked_at!).toLocaleString()}. Unlock to modify settings.`}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Question Source Section */}
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">📋 Question Source Selection</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Choose how questions will be selected for students</p>
              
              <Card className="bg-gray-50 dark:bg-gray-800">
                <div className="space-y-3">
                  <label className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition">
                    <input
                      type="radio"
                      value="fixed"
                      checked={settings.question_selection_mode === 'fixed'}
                      onChange={(e) => setSettings({ ...settings, question_selection_mode: 'fixed' })}
                      disabled={settings.questions_locked}
                      className="mr-3 mt-1"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Fixed Questions (Manual Selection)</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ✓ All students receive exactly the same set of questions
                        <br/>
                        ✓ You manually select which questions to include
                        <br/>
                        ✓ Best for standardized testing or when you want consistency
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition">
                    <input
                      type="radio"
                      value="random"
                      checked={settings.question_selection_mode === 'random'}
                      onChange={(e) => setSettings({ ...settings, question_selection_mode: 'random' })}
                      disabled={settings.questions_locked}
                      className="mr-3 mt-1"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Random from Question Bank</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ✓ Questions are randomly selected from your question bank
                        <br/>
                        ✓ Each student can get different questions based on your rules
                        <br/>
                        ✓ Best for preventing cheating and adaptive testing
                      </p>
                    </div>
                  </label>
                </div>
              </Card>
            </div>


            {/* Total Questions Section */}
            {settings.question_selection_mode === 'random' && !useDifficultyDistribution && !useMarksDistribution && (
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">🔢 Number of Questions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Specify how many questions each student should receive</p>
                
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Questions to Serve
                      </label>
                      <Input
                        type="number"
                        value={settings.total_questions_to_serve || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            total_questions_to_serve: parseInt(e.target.value) || null,
                          })
                        }
                        disabled={settings.questions_locked}
                        placeholder="Leave empty for all available questions"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        💡 Leave empty to serve all available questions from the bank
                      </p>
                    </div>
                    
                    {stats && (
                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">📊 Bank Status</p>
                        <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                          Total active questions available: <strong>{stats.active_questions}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}


            {/* Difficulty Distribution Section */}
            {settings.question_selection_mode === 'random' && (
              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">⚙️ Difficulty Distribution (Optional)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Select questions based on difficulty levels</p>
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDifficultyDistribution}
                      onChange={(e) => {
                        setUseDifficultyDistribution(e.target.checked);
                        if (e.target.checked) setUseMarksDistribution(false);
                      }}
                      disabled={settings.questions_locked}
                    />
                    <span className="text-sm font-medium dark:text-gray-300">Enable This Option</span>
                  </label>
                </div>

                {useDifficultyDistribution && (
                  <Card className="bg-gray-50 dark:bg-gray-800">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        📝 <strong>How this works:</strong> Each student gets randomly selected questions matching your difficulty counts below
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
                          <label className="block text-sm font-semibold text-green-900 dark:text-green-300 mb-2">
                            ✅ Easy Questions
                          </label>
                          <Input
                            type="number"
                            value={easyCount}
                            onChange={(e) => setEasyCount(parseInt(e.target.value) || 0)}
                            disabled={settings.questions_locked}
                            placeholder="0"
                            min="0"
                          />
                          {stats && (
                            <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                              Available: {stats.available_questions.by_difficulty.easy || 0}
                            </p>
                          )}
                        </div>

                        <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20">
                          <label className="block text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                            ⚠️ Medium Questions
                          </label>
                          <Input
                            type="number"
                            value={mediumCount}
                            onChange={(e) => setMediumCount(parseInt(e.target.value) || 0)}
                            disabled={settings.questions_locked}
                            placeholder="0"
                            min="0"
                          />
                          {stats && (
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                              Available: {stats.available_questions.by_difficulty.medium || 0}
                            </p>
                          )}
                        </div>

                        <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-900/20">
                          <label className="block text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
                            🔥 Hard Questions
                          </label>
                          <Input
                            type="number"
                            value={hardCount}
                            onChange={(e) => setHardCount(parseInt(e.target.value) || 0)}
                            disabled={settings.questions_locked}
                            placeholder="0"
                            min="0"
                          />
                          {stats && (
                            <p className="text-xs text-red-700 dark:text-red-400 mt-2">
                              Available: {stats.available_questions.by_difficulty.hard || 0}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                          📊 Total: <strong>{easyCount + mediumCount + hardCount}</strong> questions will be selected
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}


            {/* Marks Distribution Section */}
            {settings.question_selection_mode === 'random' && (
              <div className="border-l-4 border-indigo-500 pl-4 py-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">💰 Marks Distribution (Optional)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Select questions based on marks/point values</p>
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMarksDistribution}
                      onChange={(e) => {
                        setUseMarksDistribution(e.target.checked);
                        if (e.target.checked) setUseDifficultyDistribution(false);
                      }}
                      disabled={settings.questions_locked}
                    />
                    <span className="text-sm font-medium dark:text-gray-300">Enable This Option</span>
                  </label>
                </div>

                {useMarksDistribution && (
                  <Card className="bg-gray-50 dark:bg-gray-800">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        📝 <strong>How this works:</strong> Specify how many questions of each marks value to include in the exam
                      </p>

                      <div className="space-y-3">
                        {marksDistribution.map((item, index) => (
                          <div key={index} className="flex gap-2 items-end p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700">
                            <div className="flex-1">
                              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                Marks per Question
                              </label>
                              <Input
                                type="number"
                                value={item.marks}
                                onChange={(e) => updateMarksEntry(index, 'marks', parseInt(e.target.value) || 1)}
                                disabled={settings.questions_locked}
                                placeholder="0"
                                min="1"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                Count
                              </label>
                              <Input
                                type="number"
                                value={item.count}
                                onChange={(e) => updateMarksEntry(index, 'count', parseInt(e.target.value) || 1)}
                                disabled={settings.questions_locked}
                                placeholder="0"
                                min="1"
                              />
                            </div>
                            <Button 
                              variant="outline" 
                              onClick={() => removeMarksEntry(index)} 
                              disabled={settings.questions_locked}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button 
                        variant="outline" 
                        onClick={addMarksEntry} 
                        disabled={settings.questions_locked}
                        className="w-full"
                      >
                        + Add Another Marks Entry
                      </Button>

                      {marksDistribution.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-sm text-blue-900 dark:text-blue-200">
                            📊 <strong>Total:</strong> {marksDistribution.reduce((sum, item) => sum + item.count, 0)} questions | <strong>Total Marks:</strong> {marksDistribution.reduce((sum, item) => sum + item.marks * item.count, 0)}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}


            {/* Randomization Rules Section */}
            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">🎲 Randomization & Distribution Rules</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Control how questions are shuffled and distributed to students</p>

              <Card className="bg-gray-50 dark:bg-gray-800 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Shuffling Options:</p>
                  <div className="space-y-2 pl-3">
                    <label className="flex items-start p-2 rounded hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={settings.shuffle_question_order}
                        onChange={(e) => setSettings({ ...settings, shuffle_question_order: e.target.checked })}
                        disabled={settings.questions_locked}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Shuffle Question Order</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Questions appear in random order for each student (prevents copying from neighbors)</p>
                      </div>
                    </label>
                    
                    <label className="flex items-start p-2 rounded hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={settings.shuffle_option_order}
                        onChange={(e) => setSettings({ ...settings, shuffle_option_order: e.target.checked })}
                        disabled={settings.questions_locked}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Shuffle Options (MCQ only)</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Answer choices are randomized for each student (reduces guessing patterns)</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Question Distribution:</p>
                  <div className="space-y-2 pl-3">
                    <label className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition">
                      <input
                        type="radio"
                        value="same_for_all"
                        checked={settings.question_distribution === 'same_for_all'}
                        onChange={(e) => setSettings({ ...settings, question_distribution: 'same_for_all' })}
                        disabled={settings.questions_locked}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Same Questions for All Students</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Every student gets the exact same set of questions (with optional shuffling)</p>
                      </div>
                    </label>

                    <label className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition">
                      <input
                        type="radio"
                        value="unique_per_student"
                        checked={settings.question_distribution === 'unique_per_student'}
                        onChange={(e) => setSettings({ ...settings, question_distribution: 'unique_per_student' })}
                        disabled={settings.questions_locked}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Unique Questions per Student</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Each student gets a different random selection of questions from the bank</p>
                      </div>
                    </label>
                  </div>
                </div>
              </Card>
            </div>


            {/* Reuse Policy Section */}
            {settings.question_distribution === 'unique_per_student' && (
              <div className="border-l-4 border-pink-500 pl-4 py-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">♻️ Question Reuse Policy</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Control how questions can be reused when distributing to multiple students</p>

                <Card className="bg-gray-50 dark:bg-gray-800">
                  <div className="space-y-3">
                    <label className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition">
                      <input
                        type="radio"
                        value="allow_reuse"
                        checked={settings.question_reuse_policy === 'allow_reuse'}
                        onChange={(e) => setSettings({ ...settings, question_reuse_policy: 'allow_reuse' })}
                        disabled={settings.questions_locked}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Allow Question Reuse</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          ✓ Questions can appear in multiple students' exams
                          <br/>
                          ✓ Same question may be used multiple times
                          <br/>
                          ✓ Best when you have limited questions
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-700 transition">
                      <input
                        type="radio"
                        value="no_reuse_until_exhausted"
                        checked={settings.question_reuse_policy === 'no_reuse_until_exhausted'}
                        onChange={(e) => setSettings({ ...settings, question_reuse_policy: 'no_reuse_until_exhausted' })}
                        disabled={settings.questions_locked}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">No Reuse Until Pool Exhausted</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          ✓ Each question is used only once per batch
                          <br/>
                          ✓ Questions recycle only after all are distributed
                          <br/>
                          ✓ Best for fair distribution and preventing duplicates
                        </p>
                      </div>
                    </label>
                  </div>
                </Card>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={handleSaveSettings} loading={loading} disabled={settings.questions_locked}>
                Save Settings
              </Button>
              <Button variant="outline" onClick={handleGeneratePreview} loading={loading}>
                Generate Preview
              </Button>
              {!settings.questions_locked ? (
                <Button variant="success" onClick={handleLockQuestions} loading={loading}>
                  Lock Questions
                </Button>
              ) : (
                <Button variant="danger" onClick={handleUnlockQuestions} loading={loading}>
                  Unlock Questions
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            {!preview && (
              <p className="text-gray-600 dark:text-gray-400">Click "Generate Preview" to see question selection preview</p>
            )}

            {preview && (
              <>
                {preview.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
                    <p className="font-semibold mb-2">Validation Errors:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {preview.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 mb-4">
                    <p className="font-semibold mb-2">Warnings:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {preview.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.is_valid && (
                  <Alert type="success" message="✓ Question selection is valid and ready!" />
                )}

                <Card>
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Selection Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Available</p>
                      <p className="text-2xl font-bold dark:text-white">{preview.total_available}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total to Serve</p>
                      <p className="text-2xl font-bold dark:text-white">{preview.total_to_serve}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Marks</p>
                      <p className="text-2xl font-bold dark:text-white">{preview.total_marks}</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Distribution Breakdown</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium dark:text-white">By Difficulty</h4>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="bg-green-100 dark:bg-green-900 p-2 rounded">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Easy</p>
                          <p className="text-lg font-bold dark:text-white">{preview.distribution.by_difficulty.easy}</p>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Medium</p>
                          <p className="text-lg font-bold dark:text-white">{preview.distribution.by_difficulty.medium}</p>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900 p-2 rounded">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Hard</p>
                          <p className="text-lg font-bold dark:text-white">{preview.distribution.by_difficulty.hard}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium dark:text-white">By Marks</h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(preview.distribution.by_marks).map(([marks, count]) => (
                          <div key={marks} className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{marks} marks</p>
                            <p className="text-lg font-bold dark:text-white">{count} questions</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium dark:text-white">By Type</h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(preview.distribution.by_type).map(([type, count]) => (
                          <div key={type} className="bg-purple-100 dark:bg-purple-900 p-2 rounded">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{type}</p>
                            <p className="text-lg font-bold dark:text-white">{count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-semibold mb-4 dark:text-white">Sample Questions</h3>
                  <div className="space-y-2">
                    {preview.sample_questions.map((q, i) => (
                      <div key={q.id} className="border dark:border-gray-700 p-3 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          #{i + 1} • {q.type} • {q.marks} marks • {q.difficulty}
                        </p>
                        <p className="mt-1 dark:text-gray-300">{q.text}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-4">
            <Card>
              <h3 className="text-lg font-semibold mb-4 dark:text-white">Exam Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Questions</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.total_questions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Questions</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.active_questions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Selections Generated</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.selections_generated}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Questions Locked</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.questions_locked ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold mb-4 dark:text-white">Available Questions</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium dark:text-white">By Difficulty</h4>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {Object.entries(stats.available_questions.by_difficulty).map(([diff, count]) => (
                      <div key={diff} className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{diff}</p>
                        <p className="text-lg font-bold dark:text-white">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium dark:text-white">By Marks</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(stats.available_questions.by_marks).map(([marks, count]) => (
                      <div key={marks} className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{marks} marks</p>
                        <p className="text-lg font-bold dark:text-white">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QuestionRandomization;
