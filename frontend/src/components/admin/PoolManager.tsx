import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Pool {
  id: number;
  exam_id: number;
  name: string;
  description?: string;
  question_count: number;
  total_marks: number;
  draw_count: number;
  is_active: boolean;
}

interface PoolManagerProps {
  examId: number;
  onPoolsChange?: () => void;
}

const PoolManager: React.FC<PoolManagerProps> = ({ examId, onPoolsChange }) => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [stats, setStats] = useState<Record<number, any>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    draw_count: 5,
    is_active: true,
  });

  const API_URL = 'http://localhost:8000/api';

  useEffect(() => {
    if (examId) {
      fetchPools();
    }
  }, [examId]);

  const fetchPools = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/exams/${examId}/pools`);
      setPools(response.data.pools || response.data);
      
      // Fetch stats for each pool
      response.data.pools?.forEach((pool: Pool) => {
        fetchPoolStats(pool.id);
      });
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPoolStats = async (poolId: number) => {
    try {
      const response = await axios.get(`${API_URL}/exams/${examId}/pools/${poolId}/stats`);
      setStats(prev => ({ ...prev, [poolId]: response.data }));
    } catch (error) {
      console.error('Error fetching pool stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPool) {
        // Update existing pool
        await axios.put(`${API_URL}/exams/${examId}/pools/${editingPool.id}`, formData);
      } else {
        // Create new pool
        await axios.post(`${API_URL}/exams/${examId}/pools`, formData);
      }
      
      resetForm();
      fetchPools();
      onPoolsChange?.();
    } catch (error: any) {
      console.error('Error saving pool:', error);
      alert(error.response?.data?.message || 'Failed to save pool');
    }
  };

  const handleEdit = (pool: Pool) => {
    setEditingPool(pool);
    setFormData({
      name: pool.name,
      description: pool.description || '',
      draw_count: pool.draw_count,
      is_active: pool.is_active,
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (poolId: number) => {
    if (!confirm('Are you sure you want to delete this pool? Questions will be unassigned from this pool.')) return;
    
    try {
      await axios.delete(`${API_URL}/exams/${examId}/pools/${poolId}`);
      fetchPools();
      onPoolsChange?.();
    } catch (error: any) {
      console.error('Error deleting pool:', error);
      alert(error.response?.data?.message || 'Failed to delete pool');
    }
  };

  const handleToggleActive = async (pool: Pool) => {
    try {
      await axios.put(`${API_URL}/exams/${examId}/pools/${pool.id}`, {
        ...pool,
        is_active: !pool.is_active,
      });
      fetchPools();
      onPoolsChange?.();
    } catch (error: any) {
      console.error('Error toggling pool:', error);
      alert(error.response?.data?.message || 'Failed to toggle pool status');
    }
  };

  const handleDrawQuestions = async (poolId: number, drawCount: number) => {
    try {
      const response = await axios.post(`${API_URL}/exams/${examId}/pools/${poolId}/draw`, {
        count: drawCount,
      });
      
      alert(`Drew ${response.data.questions.length} questions from pool`);
      console.log('Drawn questions:', response.data.questions);
    } catch (error: any) {
      console.error('Error drawing questions:', error);
      alert(error.response?.data?.message || 'Failed to draw questions');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      draw_count: 5,
      is_active: true,
    });
    setEditingPool(null);
    setShowCreateForm(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Question Pools</h2>
          <p className="text-sm text-gray-600 mt-1">Create pools for random question selection</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i className="bx bx-plus"></i>
          {showCreateForm ? 'Cancel' : 'Create Pool'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {editingPool ? 'Edit Pool' : 'Create New Pool'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pool Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Pool A, Easy Questions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Draw Count *
                </label>
                <input
                  type="number"
                  value={formData.draw_count}
                  onChange={(e) => setFormData({ ...formData, draw_count: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Number of questions to randomly select</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this pool's purpose..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Pool</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">Only active pools can be used for randomization</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingPool ? 'Update Pool' : 'Create Pool'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pools List */}
      {loading ? (
        <div className="text-center py-8">
          <i className="bx bx-loader-alt bx-spin text-4xl text-blue-600"></i>
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="bx bx-layer text-4xl mb-2"></i>
          <p>No pools found. Create your first pool!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pools.map(pool => (
            <div
              key={pool.id}
              className={`p-4 border rounded-lg transition-all ${
                pool.is_active
                  ? 'border-blue-200 bg-blue-50/50'
                  : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-gray-800">{pool.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        pool.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {pool.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {pool.description && (
                    <p className="text-sm text-gray-600 mb-2">{pool.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(pool)}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                    title={pool.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <i className={`bx ${pool.is_active ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                  </button>
                  <button
                    onClick={() => handleEdit(pool)}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                    title="Edit"
                  >
                    <i className="bx bx-edit text-xl"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(pool.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Delete"
                  >
                    <i className="bx bx-trash text-xl"></i>
                  </button>
                </div>
              </div>

              {/* Pool Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Questions</div>
                  <div className="text-xl font-bold text-gray-800">{pool.question_count}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Total Marks</div>
                  <div className="text-xl font-bold text-gray-800">{pool.total_marks}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Draw Count</div>
                  <div className="text-xl font-bold text-blue-600">{pool.draw_count}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Avg Marks</div>
                  <div className="text-xl font-bold text-gray-800">
                    {stats[pool.id]?.average_marks?.toFixed(1) || '-'}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              {pool.question_count > 0 && pool.is_active && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDrawQuestions(pool.id, pool.draw_count)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <i className="bx bx-shuffle"></i>
                    Draw {pool.draw_count} Questions
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PoolManager;
