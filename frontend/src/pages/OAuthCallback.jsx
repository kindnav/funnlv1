import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFundSettings } from '../lib/api';

export default function OAuthCallback({ onAuthComplete }) {
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');

    if (err) {
      setError(err || 'Authentication failed. Please try again.');
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    // httpOnly cookie is already set by the backend before this redirect.
    // Refresh App-level user state, then decide where to go.
    (async () => {
      try {
        if (onAuthComplete) await onAuthComplete();
        const settings = await getFundSettings().catch(() => null);
        if (settings?.onboarding_complete) {
          navigate('/');
        } else {
          navigate('/onboarding');
        }
      } catch {
        navigate('/onboarding');
      }
    })();
  }, [navigate, onAuthComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen w-screen bg-[#0c0c12] flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#f05252]/10 border border-[#f05252]/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-[#f05252] text-xl">!</span>
            </div>
            <p className="text-[#f05252] font-medium mb-1">Connection Failed</p>
            <p className="text-[rgba(255,255,255,0.4)] text-sm">{error}</p>
            <p className="text-[rgba(255,255,255,0.3)] text-xs mt-2">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full border-2 border-[#7c6dfa] border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-white font-medium mb-1">Connecting Gmail</p>
            <p className="text-[rgba(255,255,255,0.4)] text-sm">Syncing your inbox...</p>
          </>
        )}
      </div>
    </div>
  );
}
