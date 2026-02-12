import { api } from '../../services/api';

export interface CurrentStudentProfile {
  id: number;
  registration_number?: string;
  first_name?: string;
  last_name?: string;
  other_names?: string;
  email?: string;
  class_level?: string;
  department?: string | null;
  class_name?: string | null;
  completed_attempts?: number;
  average_score?: number;
}

const matchStudentByEmail = (rows: any[], email?: string): CurrentStudentProfile | null => {
  if (!email) return null;
  const found = rows.find((row) => String(row?.email || '').toLowerCase() === email.toLowerCase());
  return found || null;
};

export const getCurrentStudentProfile = async (): Promise<CurrentStudentProfile> => {
  try {
    const response = await api.get('/student/me');
    if (response.data?.id) {
      return response.data;
    }
  } catch {
    // Fallback below.
  }

  const userRaw = localStorage.getItem('user');
  if (!userRaw) {
    throw new Error('Authentication context is missing.');
  }

  const user = JSON.parse(userRaw);
  const email = user?.email;

  const fallback = await api.get('/students', {
    params: {
      search: email || '',
      limit: 20,
    },
  });

  const rows: any[] = fallback.data?.data || [];
  const matched = matchStudentByEmail(rows, email);

  if (!matched || !matched.id) {
    throw new Error('Student profile was not found for the current account.');
  }

  return matched;
};
