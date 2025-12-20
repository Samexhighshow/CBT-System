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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onPreview(question.id)}
                        title="Preview"
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 hover:text-blue-600"
                      >
                        <i className='bx bx-eye'></i>
                      </button>
                      <button
                        onClick={() => onDuplicate(question.id)}
                        title="Duplicate"
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 hover:text-green-600"
                      >
                        <i className='bx bx-copy'></i>
                      </button>
                      <button
                        onClick={() => onEdit(question)}
                        title="Edit"
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 hover:text-blue-600"
                      >
                        <i className='bx bx-pencil'></i>
                      </button>
                      <button
                        onClick={() => onToggleStatus(question.id)}
                        title="Toggle Status"
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 hover:text-yellow-600"
                      >
                        <i className='bx bx-toggle-right'></i>
                      </button>
                      <button
                        onClick={() => onDelete(question.id)}
                        title="Delete"
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600 hover:text-red-600"
                      >
                        <i className='bx bx-trash'></i>
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
