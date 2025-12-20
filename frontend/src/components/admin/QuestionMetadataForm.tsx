import React from 'react';
import TagSelector from './TagSelector';

interface QuestionMetadataFormProps {
  formData: {
    pool_name?: string;
    topics?: string[];
    cognitive_level?: string;
    estimated_time?: number;
    author_notes?: string;
    is_template?: boolean;
    tag_ids?: number[];
  };
  onChange: (field: string, value: any) => void;
}

const COGNITIVE_LEVELS = [
  { value: 'remember', label: 'Remember', description: 'Recall facts and basic concepts' },
  { value: 'understand', label: 'Understand', description: 'Explain ideas or concepts' },
  { value: 'apply', label: 'Apply', description: 'Use information in new situations' },
  { value: 'analyze', label: 'Analyze', description: 'Draw connections among ideas' },
  { value: 'evaluate', label: 'Evaluate', description: 'Justify a decision or course of action' },
  { value: 'create', label: 'Create', description: 'Produce new or original work' },
];

const QuestionMetadataForm: React.FC<QuestionMetadataFormProps> = ({ formData, onChange }) => {
  const handleTopicAdd = (topic: string) => {
    if (topic.trim()) {
      const topics = formData.topics || [];
      if (!topics.includes(topic.trim())) {
        onChange('topics', [...topics, topic.trim()]);
      }
    }
  };

  const handleTopicRemove = (topic: string) => {
    const topics = formData.topics || [];
    onChange('topics', topics.filter(t => t !== topic));
  };

  const [topicInput, setTopicInput] = React.useState('');

  return (
    <div className="space-y-6">
      {/* Cognitive Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cognitive Level (Bloom's Taxonomy)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {COGNITIVE_LEVELS.map(level => (
            <label
              key={level.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                formData.cognitive_level === level.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="cognitive_level"
                value={level.value}
                checked={formData.cognitive_level === level.value}
                onChange={(e) => onChange('cognitive_level', e.target.value)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800">{level.label}</div>
                <div className="text-xs text-gray-600">{level.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Tags
        </label>
        <TagSelector
          selectedTagIds={formData.tag_ids || []}
          onChange={(tagIds) => onChange('tag_ids', tagIds)}
          placeholder="Select tags to categorize this question..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Tags help organize and filter questions
        </p>
      </div>

      {/* Topics/Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Topics / Keywords
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTopicAdd(topicInput);
                setTopicInput('');
              }
            }}
            placeholder="Type a topic and press Enter..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              handleTopicAdd(topicInput);
              setTopicInput('');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Add
          </button>
        </div>
        {formData.topics && formData.topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.topics.map((topic, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => handleTopicRemove(topic)}
                  className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                >
                  <i className="bx bx-x text-base"></i>
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Add specific topics or keywords related to this question
        </p>
      </div>

      {/* Pool Assignment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pool Name (Optional)
        </label>
        <input
          type="text"
          value={formData.pool_name || ''}
          onChange={(e) => onChange('pool_name', e.target.value)}
          placeholder="e.g., Pool A, Easy Questions, Chapter 1"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Assign to a pool for future randomization
        </p>
      </div>

      {/* Estimated Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Estimated Time (minutes)
        </label>
        <input
          type="number"
          value={formData.estimated_time || ''}
          onChange={(e) => onChange('estimated_time', e.target.value ? parseInt(e.target.value) : undefined)}
          min="1"
          max="180"
          placeholder="e.g., 5"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          How long should students spend on this question?
        </p>
      </div>

      {/* Author Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Author Notes (Internal)
        </label>
        <textarea
          value={formData.author_notes || ''}
          onChange={(e) => onChange('author_notes', e.target.value)}
          placeholder="Internal notes about this question (not visible to students)..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          Private notes for instructors and question authors
        </p>
      </div>

      {/* Template Flag */}
      <div>
        <label className="flex items-start gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.is_template || false}
            onChange={(e) => onChange('is_template', e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-800 mb-1">
              <i className="bx bx-file-blank mr-2"></i>
              Mark as Template
            </div>
            <div className="text-sm text-gray-600">
              Template questions can be reused across multiple exams. They won't be counted in exam statistics.
            </div>
          </div>
        </label>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <i className="bx bx-info-circle text-2xl text-blue-600 flex-shrink-0"></i>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Question Organization Features</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Use <strong>Tags</strong> for broad categorization across all exams</li>
              <li>Use <strong>Topics</strong> for specific keywords related to this question</li>
              <li>Use <strong>Pools</strong> to enable randomization in future exam deliveries</li>
              <li><strong>Cognitive Level</strong> helps track question complexity using Bloom's Taxonomy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionMetadataForm;
