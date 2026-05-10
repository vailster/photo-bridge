'use client';

import { useEffect } from 'react';

export default function PickerCallback() {
  useEffect(() => {
    // Notify the main window if possible
    if (window.opener) {
      window.opener.postMessage('PICKER_DONE', '*');
    }
    // Close the popup automatically
    window.close();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-sans">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Selection Complete</h1>
        <p>You can close this window now.</p>
      </div>
    </div>
  );
}
