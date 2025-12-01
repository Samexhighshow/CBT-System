import React, { useState } from 'react';
import { Card, Button } from './index';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import { QRCodeSVG } from 'qrcode.react';

interface TwoFactorSetupProps {
  user: any;
  onComplete?: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const startSetup = async () => {
    try {
      setLoading(true);
      const response = await api.post('/two-factor/setup');
      setQrCode(response.data.qr_code);
      setSecret(response.data.secret);
      setStep(2);
    } catch (error) {
      showError('Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/two-factor/verify', {
        code: verificationCode,
      });
      
      setRecoveryCodes(response.data.recovery_codes || []);
      setStep(3);
      showSuccess('Two-factor authentication enabled!');
    } catch (error) {
      showError('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const downloadRecoveryCodes = () => {
    const content = `Recovery Codes for ${user?.email}\nGenerated: ${new Date().toLocaleString()}\n\n${recoveryCodes.join('\n')}\n\nKeep these codes safe!`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const finish = () => {
    if (onComplete) onComplete();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Two-Factor Authentication Setup</h2>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-gray-600">
            Two-factor authentication adds an extra layer of security to your account by requiring a verification code from your phone.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Before you begin:</h3>
            <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
              <li>Install Google Authenticator, Authy, or similar app on your phone</li>
              <li>Have your phone ready to scan a QR code</li>
              <li>Save the recovery codes in a safe place</li>
            </ul>
          </div>
          <Button onClick={startSetup} loading={loading}>
            Start Setup
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Scan this QR code with your authenticator app:</p>
            <div className="inline-block p-4 bg-white border rounded">
              {qrCode && <QRCodeSVG value={qrCode} size={200} />}
            </div>
            <p className="text-sm text-gray-500 mt-2">Or enter this code manually:</p>
            <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">{secret}</code>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Enter verification code:</label>
            <input
              type="text"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="border rounded px-4 py-2 w-full text-center text-2xl tracking-widest"
              placeholder="000000"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep(1)} variant="secondary">
              Back
            </Button>
            <Button onClick={verifyAndEnable} loading={loading}>
              Verify & Enable
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
            <i className='bx bx-check-circle text-4xl text-green-600'></i>
            <p className="text-green-900 font-semibold mt-2">2FA Enabled Successfully!</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Save Your Recovery Codes</h3>
            <p className="text-sm text-yellow-800 mb-3">
              If you lose access to your authenticator app, you'll need these codes to log in.
            </p>
            <div className="bg-white rounded p-3 font-mono text-sm space-y-1 mb-3">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="flex justify-between">
                  <span>{i + 1}.</span>
                  <span>{code}</span>
                </div>
              ))}
            </div>
            <Button onClick={downloadRecoveryCodes} variant="secondary" size="sm">
              <i className='bx bx-download mr-2'></i>
              Download Recovery Codes
            </Button>
          </div>

          <Button onClick={finish} className="w-full">
            Finish
          </Button>
        </div>
      )}
    </Card>
  );
};

export default TwoFactorSetup;
