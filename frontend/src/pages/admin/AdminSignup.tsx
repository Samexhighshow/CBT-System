import React, { useState } from 'react';
import axios from 'axios';
import { showSuccess, showError } from '../../utils/alerts';

const AdminSignup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://127.0.0.1:8000/api/admin/signup', { name, email, password });
      showSuccess('Application submitted. Please verify your email.');
      setName(''); setEmail(''); setPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit application';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-xl font-semibold mb-4">Admin Signup</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          {loading ? 'Submitting...' : 'Apply'}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-3">We will email a verification link. After verification, a Main Admin will review and assign appropriate roles.</p>
    </div>
  );
};

export default AdminSignup;
