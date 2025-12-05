import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Alert, Loading } from '../../components';
import api from '../../services/api';

interface StudentAllocation {
  exam: any;
  allocation: {
    id: number;
    hall: any;
    row: number;
    column: number;
    seat_number: number;
  };
  surrounding_students: Array<{
    student: any;
    row: number;
    column: number;
    direction: string;
  }>;
}

const MyAllocation: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [allocation, setAllocation] = useState<StudentAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (examId) {
      fetchMyAllocation();
    }
  }, [examId]);

  const fetchMyAllocation = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/allocations/my-seat/${examId}`);
      setAllocation(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('You have not been allocated a seat for this exam yet.');
      } else {
        setError(err.response?.data?.message || 'Failed to load seat allocation');
      }
    } finally {
      setLoading(false);
    }
  };

  const printAllocation = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert type="info" message={error} />
      </div>
    );
  }

  if (!allocation) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert type="info" message="No allocation found for this exam." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start print:block">
        <div>
          <h1 className="text-2xl font-bold">My Seat Allocation</h1>
          <p className="text-gray-600">{allocation.exam.title}</p>
          <p className="text-sm text-gray-500">
            Date: {new Date(allocation.exam.exam_date).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={printAllocation}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 print:hidden"
        >
          🖨️ Print
        </button>
      </div>

      {/* Seat Information Card */}
      <Card className="p-6 mb-6 bg-blue-50 border-2 border-blue-300">
        <h2 className="text-xl font-bold mb-4 text-blue-900">Your Seat Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Exam Hall</div>
            <div className="text-2xl font-bold text-blue-900">{allocation.allocation.hall.name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Seat Number</div>
            <div className="text-2xl font-bold text-blue-900">#{allocation.allocation.seat_number}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Row</div>
            <div className="text-xl font-medium text-blue-900">{allocation.allocation.row}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Column</div>
            <div className="text-xl font-medium text-blue-900">{allocation.allocation.column}</div>
          </div>
        </div>
      </Card>

      {/* Mini Seating Map */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Seat Location</h3>
        <div className="flex justify-center">
          <div className="inline-grid grid-cols-3 gap-2">
            {[-1, 0, 1].map((rowOffset) => (
              <React.Fragment key={rowOffset}>
                {[-1, 0, 1].map((colOffset) => {
                  const isCurrentSeat = rowOffset === 0 && colOffset === 0;
                  const surrounding = allocation.surrounding_students.find(
                    (s) =>
                      s.row === allocation.allocation.row + rowOffset &&
                      s.column === allocation.allocation.column + colOffset
                  );

                  return (
                    <div
                      key={`${rowOffset}-${colOffset}`}
                      className={`
                        border-2 p-4 min-w-[100px] min-h-[80px] flex flex-col items-center justify-center rounded
                        ${
                          isCurrentSeat
                            ? 'bg-blue-600 border-blue-700 text-white font-bold shadow-lg'
                            : surrounding
                            ? 'bg-gray-100 border-gray-300 text-gray-700'
                            : 'bg-white border-gray-200 text-gray-400'
                        }
                      `}
                    >
                      {isCurrentSeat ? (
                        <>
                          <div className="text-xs mb-1">YOU</div>
                          <div className="text-xl">#{allocation.allocation.seat_number}</div>
                        </>
                      ) : surrounding ? (
                        <>
                          <div className="text-xs text-gray-500">{surrounding.direction}</div>
                          <div className="text-sm text-center">
                            {surrounding.student?.name || surrounding.student?.user?.name || 'Student'}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs">Empty</div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-3">Important Instructions</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Please arrive at least 15 minutes before the exam starts</li>
          <li>Bring your student ID card for verification</li>
          <li>Only sit at your assigned seat number</li>
          <li>No electronic devices except approved calculators</li>
          <li>Follow all exam hall rules and regulations</li>
        </ul>
      </Card>

      {/* Hall Details */}
      {allocation.allocation.hall.notes && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-bold mb-3">Hall Notes</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{allocation.allocation.hall.notes}</p>
        </Card>
      )}
    </div>
  );
};

export default MyAllocation;
