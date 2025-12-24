import React, { useState } from 'react';

interface Subject {
  id: number;
  name: string;
}

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  difficulty?: string;
  status?: string;
  section_name?: string;
  order_index?: number;
  subject_id?: number;
  class_level?: string;
  subject?: Subject;
  options?: any[];
  instructions?: string;
}

interface QuestionTableProps {
  questions: Question[];
  selectedIds: Set<number>;
  onSelectChange: (id: number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onEdit: (question: Question) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onToggleStatus: (id: number) => void;
  onPreview: (id: number) => void;
  onVersionHistory?: (id: number) => void;
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
  onSelectAll,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onPreview,
  onVersionHistory,
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
    if (onSelectAll) {
      onSelectAll(e.target.checked);
    } else {
      questions.forEach((q) => {
        onSelectChange(q.id, e.target.checked);
      });
    }
  };

  const allSelected = questions.length > 0 && questions.every((q) => selectedIds.has(q.id));

  return (
    <>
      <table className="min-w-full text-xs border-collapse bg-white">
        <thead>
          <tr className="bg-gray-50 text-gray-700 border-b">
            <th className="px-3 py-2 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 cursor-pointer"
              />
            </th>
            <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">QID</th>
            <th className="px-3 py-2 text-left font-semibold">
              Question
            </th>
            <th className="px-3 py-2 text-left font-semibold">Type</th>
            <th className="px-3 py-2 text-left font-semibold">Subject</th>
            <th className="px-3 py-2 text-left font-semibold">Class</th>
            <th className="px-3 py-2 text-center font-semibold">Marks</th>
            <th className="px-3 py-2 text-center font-semibold">Difficulty</th>
            <th className="px-3 py-2 text-center font-semibold">Status</th>
            <th className="px-3 py-2 text-left font-semibold">Used In</th>
            <th className="px-3 py-2 text-left font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {questions.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
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

                    {/* QID - Question ID */}
                    <td className="px-3 py-2 text-gray-600 font-semibold whitespace-nowrap">
                      #{question.id}
                    </td>

                    {/* Question Text */}
                    <td className="px-3 py-2 text-gray-900 max-w-sm">
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

                    {/* Subject */}
                    <td className="px-3 py-2 text-gray-600 text-sm">
                      {question.subject?.name || (question as any).subject_name || '-'}
                    </td>

                    {/* Class Level */}
                    <td className="px-3 py-2 text-gray-600 text-sm whitespace-nowrap">
                      {question.class_level || '-'}
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

                    {/* Used In */}
                    <td className="px-3 py-2 text-gray-600 text-sm">
                      <span className="text-xs text-gray-500">-</span>
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
                ))
              )}
            </tbody>
          </table>

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
