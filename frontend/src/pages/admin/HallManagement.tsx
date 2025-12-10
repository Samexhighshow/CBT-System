import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input, Alert } from '../../components';
import api from '../../services/api';

interface Hall {
  id: number;
  name: string;
  rows: number;
  columns: number;
  capacity: number;
  teachers_needed: number;
  notes?: string;
  is_active: boolean;
  allocations_count?: number;
}

const HallManagement: React.FC = () => {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [selectedHallIds, setSelectedHallIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    rows: 10,
    columns: 10,
    teachers_needed: 2,
    notes: '',
    is_active: true,
  });

  const handleSelectAllHalls = (checked: boolean) => {
    setSelectedHallIds(checked ? halls.map((h: Hall) => h.id) : []);
  };
  const handleSelectOneHall = (id: number, checked: boolean) => {
    setSelectedHallIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };
  const handleBatchDeleteHalls = async () => {
    if (selectedHallIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedHallIds.length} selected halls?`)) return;
    try {
      await Promise.all(selectedHallIds.map(id => api.delete(`/halls/${id}`)));
      setSelectedHallIds([]);
      setSuccess('Selected halls deleted');
      fetchHalls();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete selected halls');
    }
  };

  useEffect(() => {
    fetchHalls();
  }, []);

  const fetchHalls = async () => {
    setLoading(true);
    try {
      const response = await api.get('/halls');
      setHalls(response.data.data || response.data.halls || response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load halls');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingHall) {
        await api.put(`/halls/${editingHall.id}`, formData);
        setSuccess('Hall updated successfully');
      } else {
        await api.post('/halls', formData);
        setSuccess('Hall created successfully');
      }
      setShowModal(false);
      fetchHalls();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save hall');
    }
  };

  const handleEdit = (hall: Hall) => {
    setEditingHall(hall);
    setFormData({
      name: hall.name,
      rows: hall.rows,
      columns: hall.columns,
      teachers_needed: hall.teachers_needed,
      notes: hall.notes || '',
      is_active: hall.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this hall?')) return;

    try {
      await api.delete(`/halls/${id}`);
      setSuccess('Hall deleted successfully');
      fetchHalls();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete hall');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      rows: 10,
      columns: 10,
      teachers_needed: 2,
      notes: '',
      is_active: true,
    });
    setEditingHall(null);
  };

  const getTotalCapacity = () => {
    return halls
      .filter(h => h.is_active)
      .reduce((sum, h) => sum + h.capacity, 0);
  };

  return (
    <div className="app-shell section-shell">
      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Hall Management</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Configure exam halls and seating capacity</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="text-xs md:text-sm py-1.5 px-3"
        >
          + Add Hall
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-4">
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Total Halls</div>
          <div className="text-lg md:text-xl font-bold">{halls.length}</div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Active Halls</div>
          <div className="text-lg md:text-xl font-bold text-green-600">
            {halls.filter(h => h.is_active).length}
          </div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Total Capacity</div>
          <div className="text-lg md:text-xl font-bold text-blue-600">{getTotalCapacity()}</div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Avg. Capacity</div>
          <div className="text-lg md:text-xl font-bold">
            {halls.length > 0 ? Math.round(getTotalCapacity() / halls.filter(h => h.is_active).length) : 0}
          </div>
        </Card>
      </div>

      {/* Halls List */}
      <Card className="panel-compact">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
          <h2 className="text-lg md:text-xl font-semibold">Halls ({halls.length})</h2>
          <Button variant="danger" disabled={selectedHallIds.length === 0} onClick={handleBatchDeleteHalls} className="text-xs py-1 px-2">
            Delete Selected ({selectedHallIds.length})
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2">
                  <input type="checkbox" checked={selectedHallIds.length === halls.length && halls.length > 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectAllHalls(e.target.checked)} title="Select all halls" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grid</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teachers</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Allocations</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : halls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No halls configured. Add your first hall to get started.
                  </td>
                </tr>
              ) : (
                halls.map((hall) => (
                  <tr key={hall.id}>
                    <td className="px-2 py-4">
                      <input type="checkbox" checked={selectedHallIds.includes(hall.id)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectOneHall(hall.id, e.target.checked)} title={`Select hall ${hall.name}`} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{hall.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{hall.rows} × {hall.columns}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-blue-600 font-semibold">{hall.capacity}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{hall.teachers_needed}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{hall.is_active ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Inactive</span>
                    )}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{hall.allocations_count || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      <button onClick={() => handleEdit(hall)} className="text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDelete(hall.id)} className="text-red-600 hover:text-red-800" disabled={!!hall.allocations_count}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          title={editingHall ? 'Edit Hall' : 'Add New Hall'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hall Name *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Main Hall A"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rows *
                </label>
                <Input
                  type="number"
                  value={formData.rows}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, rows: parseInt(e.target.value) })}
                  min={1}
                  max={100}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Columns *
                </label>
                <Input
                  type="number"
                  value={formData.columns}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, columns: parseInt(e.target.value) })}
                  min={1}
                  max={100}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity (Computed)
              </label>
              <div className="text-2xl font-bold text-blue-600">
                {formData.rows * formData.columns} seats
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teachers Needed
              </label>
              <Input
                type="number"
                value={formData.teachers_needed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, teachers_needed: parseInt(e.target.value) })}
                min={1}
                max={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this hall..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active (available for allocation)
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingHall ? 'Update Hall' : 'Create Hall'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default HallManagement;
