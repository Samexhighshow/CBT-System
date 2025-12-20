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

interface QuestionTableProps {
  questions: Question[];
  selectedIds: Set<number>;
  onSelectChange: (id: number, selected: boolean) => void;
  onEdit: (question: Question) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onToggleStatus: (id: number) => void;
  onPreview: (id: number) => void;
  isLoading?: boolean;
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

export const QuestionTable: React.FC<QuestionTableProps> = ({
  questions,
  selectedIds,
  onSelectChange,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onPreview,
  isLoading = false,
}) => {
  const [contextMenuId, setContextMenuId] = useState<number | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent, questionId: number) => {
    e.preventDefault();
    setContextMenuId(questionId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    questions.forEach((q) => {
      onSelectChange(q.id, e.target.checked);
    });
  };

  const allSelected = questions.length > 0 && questions.every((q) => selectedIds.has(q.id));

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-64">
                  Question
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Marks</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Difficulty</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Section</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <i className='bx bx-inbox text-4xl text-gray-300'></i>
                      <p>No questions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                questions.map((question, index) => (
                  <tr
                    key={question.id}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                      selectedIds.has(question.id) ? 'bg-blue-50' : ''
                    }`}
                    onContextMenu={(e) => handleContextMenu(e, question.id)}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(question.id)}
                        onChange={(e) => onSelectChange(question.id, e.target.checked)}
                        className="rounded border-gray-300 cursor-pointer"
                      />
                    </td>

                    {/* Question Number */}
                    <td className="px-3 py-2 text-gray-600 font-medium">
                      {question.order_index || index + 1}
                    </td>

                    {/* Question Text */}
                    <td className="px-3 py-2 text-gray-900 max-w-xs">
                      <div className="truncate text-sm hover:text-blue-600 cursor-help" title={question.question_text}>
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
                    <td className="px-3 py-2 text-center text-gray-900 font-semibold">
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

                    {/* Section */}
                    <td className="px-3 py-2 text-gray-600 text-sm">
                      {question.section_name || '-'}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuId && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-48"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onMouseLeave={() => setContextMenuId(null)}
        >
          <button
            onClick={() => {
              const q = questions.find((q) => q.id === contextMenuId);
              if (q) onEdit(q);
              setContextMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 flex items-center gap-2"
          >
            <i className='bx bx-pencil text-blue-600'></i>
            Edit
          </button>
          <button
            onClick={() => {
              onDuplicate(contextMenuId);
              setContextMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-green-50 flex items-center gap-2"
          >
            <i className='bx bx-copy text-green-600'></i>
            Duplicate
          </button>
          <button
            onClick={() => {
              onPreview(contextMenuId);
              setContextMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-purple-50 flex items-center gap-2"
          >
            <i className='bx bx-eye text-purple-600'></i>
            Preview
          </button>
          <button
            onClick={() => {
              onToggleStatus(contextMenuId);
              setContextMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-yellow-50 flex items-center gap-2"
          >
            <i className='bx bx-toggle-right text-yellow-600'></i>
            Toggle Status
          </button>
          <div className="my-1 border-t border-gray-200"></div>
          <button
            onClick={() => {
              onDelete(contextMenuId);
              setContextMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <i className='bx bx-trash'></i>
            Delete
          </button>
        </div>
      )}
    </>
  );
};
