import React, { useState } from 'react';

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  difficulty?: string;
  status?: string;
  section_name?: string;
  order_index?: number;
}

interface SectionGroupProps {
  section: {
    name: string;
    questions: Question[];
    totalMarks: number;
    questionCount: number;
  };
  selectedIds: Set<number>;
  onSelectChange: (id: number, selected: boolean) => void;
  onEdit: (question: Question) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onToggleStatus: (id: number) => void;
  onPreview: (id: number) => void;
  onVersionHistory?: (id: number) => void;
}

const getDifficultyColor = (difficulty?: string) => {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'hard':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'disabled':
      return 'bg-red-100 text-red-800';
    case 'draft':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatQuestionType = (type: string) => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const SectionGroup: React.FC<SectionGroupProps> = ({
  section,
  selectedIds,
  onSelectChange,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onPreview,
  onVersionHistory,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const sectionQuestionsSelected = section.questions.filter((q) => selectedIds.has(q.id)).length;
  const allSectionSelected =
    section.questions.length > 0 &&
    section.questions.every((q) => selectedIds.has(q.id));

  const handleSelectAllInSection = (e: React.ChangeEvent<HTMLInputElement>) => {
    section.questions.forEach((q) => {
      onSelectChange(q.id, e.target.checked);
    });
  };

  return (
    <div className="mb-4">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-blue-100 rounded transition-colors text-blue-600"
            >
              <i className={`bx bx-chevron-${isExpanded ? 'down' : 'right'} text-lg`}></i>
            </button>
            <input
              type="checkbox"
              checked={allSectionSelected}
              onChange={handleSelectAllInSection}
              className="rounded border-gray-300 cursor-pointer"
            />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                {section.name}
                {sectionQuestionsSelected > 0 && (
                  <span className="ml-2 text-blue-600 font-normal">
                    ({sectionQuestionsSelected}/{section.questionCount} selected)
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-600">
                {section.questionCount} questions • {section.totalMarks} marks
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Questions in Section */}
      {isExpanded && (
        <div className="border border-t-0 border-gray-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 w-8">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Question</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 w-12">Marks</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Difficulty</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {section.questions.map((question, index) => (
                <tr
                  key={question.id}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    selectedIds.has(question.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(question.id)}
                      onChange={(e) => onSelectChange(question.id, e.target.checked)}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </td>

                  {/* Question Number */}
                  <td className="px-3 py-2 text-gray-600 font-medium w-8">
                    {question.order_index || index + 1}
                  </td>

                  {/* Question Text */}
                  <td className="px-3 py-2 text-gray-900">
                    <div className="truncate text-sm hover:text-blue-600 cursor-help max-w-xs" title={question.question_text}>
                      {question.question_text.substring(0, 80)}
                      {question.question_text.length > 80 ? '...' : ''}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2 text-gray-600">
                    <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs font-medium">
                      {formatQuestionType(question.question_type)}
                    </span>
                  </td>

                  {/* Marks */}
                  <td className="px-3 py-2 text-center text-gray-900 font-semibold w-12">
                    {question.marks}
                  </td>

                  {/* Difficulty */}
                  <td className="px-3 py-2 text-center">
                    {question.difficulty ? (
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                        {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(question.status)}`}>
                      {question.status ? question.status.charAt(0).toUpperCase() + question.status.slice(1) : 'Active'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit - Blue */}
                      <button
                        onClick={() => onEdit(question)}
                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200 transform hover:scale-110"
                        title="Edit"
                      >
                        <i className='bx bx-edit text-base'></i>
                      </button>

                      {/* Dropdown Menu */}
                      <div className="relative group">
                        <button
                          className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all duration-200 transform hover:scale-110"
                          title="More actions"
                        >
                          <i className='bx bx-dots-vertical-rounded text-base'></i>
                        </button>
                        
                        {/* Dropdown menu - shows on hover */}
                        <div className="absolute right-0 bottom-full mb-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                          {/* View/Preview */}
                          <button
                            onClick={() => onPreview(question.id)}
                            className="w-full text-left px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                          >
                            <i className='bx bx-show text-blue-500'></i>
                            <span className="font-medium">Preview</span>
                          </button>
                          
                          {onVersionHistory && (
                            <button
                              onClick={() => onVersionHistory(question.id)}
                              className="w-full text-left px-4 py-3 text-sm text-purple-700 hover:bg-purple-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                            >
                              <i className='bx bx-history text-purple-500'></i>
                              <span className="font-medium">View History</span>
                            </button>
                          )}
                          
                          {/* Duplicate */}
                          <button
                            onClick={() => onDuplicate(question.id)}
                            className="w-full text-left px-4 py-3 text-sm text-green-700 hover:bg-green-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                          >
                            <i className='bx bx-copy text-green-500'></i>
                            <span className="font-medium">Duplicate</span>
                          </button>
                          
                          {/* Toggle Status */}
                          <button
                            onClick={() => onToggleStatus(question.id)}
                            className="w-full text-left px-4 py-3 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-3 transition-colors"
                          >
                            <i className='bx bx-toggle-right text-amber-500'></i>
                            <span className="font-medium">Toggle Status</span>
                          </button>
                        </div>
                      </div>

                      {/* Delete - Red */}
                      <button
                        onClick={() => onDelete(question.id)}
                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200 transform hover:scale-110"
                        title="Delete"
                      >
                        <i className='bx bx-trash text-base'></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
