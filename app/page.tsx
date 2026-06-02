'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { FaGoogle, FaFlickr, FaSignOutAlt } from 'react-icons/fa';
import PhotoGrid from '@/components/PhotoGrid';

export default function Home() {
  const { data: session } = useSession();
  const [hasFlickrToken, setHasFlickrToken] = useState(false);
  const [flickrUsername, setFlickrUsername] = useState<string | null>(null);

  const checkFlickr = async () => {
    try {
      const res = await fetch('/api/flickr/status');
      if (res.ok) {
        const data = await res.json();
        setHasFlickrToken(data.connected);
        setFlickrUsername(data.username);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkFlickr();
  }, []);

  const handleFlickrDisconnect = async () => {
    try {
      const res = await fetch('/api/flickr/disconnect', { method: 'POST' });
      if (res.ok) {
        setHasFlickrToken(false);
        setFlickrUsername(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // if (status === 'loading') {
  //   return <div className="container flex justify-center items-center h-screen">Loading...</div>;
  // }

  const bothConnected = !!(session && hasFlickrToken);

  return (
    <main className={`container ${bothConnected ? 'has-nav' : ''} animate-fade-in`}>
      {bothConnected ? (
        <nav className="floating-nav">
          <div className="nav-brand">
            <span className="logo-text">PhotoBridge</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-xs border-r border-gray-800/80 pr-4">
              <div className="flex items-center gap-1.5 text-green-400 font-semibold">
                <span className="status-dot glowing !w-1.5 !h-1.5"></span>
                Google Photos
              </div>
              <div className="flex items-center gap-1.5 text-green-400 font-semibold">
                <span className="status-dot glowing !w-1.5 !h-1.5"></span>
                Flickr
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button 
                onClick={() => signOut()} 
                className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xs"
              >
                Disconnect Google
              </button>
              <span className="text-gray-700">|</span>
              <button 
                onClick={handleFlickrDisconnect} 
                className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xs"
              >
                Disconnect Flickr
              </button>
            </div>
          </div>
        </nav>
      ) : (
        <div className="header animate-fade-in">
          <h1>PhotoBridge</h1>
          <p>Seamlessly export your Google Photos directly to your Flickr photostream.</p>
        </div>
      )}

      <div className="dashboard-container">
        {!bothConnected && (
          /* Step 1 & 2 Grid */
          <div className="steps-grid">
            {/* Step 1: Connect Google */}
            <div className="glass-panel step-card text-center">
              <div>
                <h2 className="text-gray-300 tracking-wide uppercase text-xs font-bold mb-3">Step 1: Google Account</h2>
                <p className="text-sm text-gray-400 mb-6">Browse and select your photos securely</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                {session ? (
                  <>
                    <div className="status-pill">
                      <span className="status-dot glowing"></span>
                      Connected to Photos
                    </div>
                    <button 
                      className="btn btn-gray text-xs px-4 py-2"
                      onClick={() => signOut()}
                    >
                      <FaSignOutAlt className="text-gray-400" /> Sign Out
                    </button>
                  </>
                ) : (
                  <button className="btn btn-google w-full" onClick={() => signIn('google')}>
                    <FaGoogle /> Connect Google Photos
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Connect Flickr */}
            <div className="glass-panel step-card text-center">
              <div>
                <h2 className="text-gray-300 tracking-wide uppercase text-xs font-bold mb-3">Step 2: Flickr Account</h2>
                <p className="text-sm text-gray-400 mb-6">Authorize destination photostream write permissions</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                {hasFlickrToken ? (
                  <>
                    <div className="status-pill">
                      <span className="status-dot glowing"></span>
                      Connected to Flickr
                    </div>
                    <button 
                      className="btn btn-gray text-xs px-4 py-2"
                      onClick={handleFlickrDisconnect}
                    >
                      <FaSignOutAlt className="text-gray-400" /> Disconnect
                    </button>
                  </>
                ) : (
                  <button 
                    className={`btn btn-flickr w-full ${!session ? 'btn-disabled' : ''}`}
                    onClick={() => session && (window.location.href = '/api/flickr/request-token')}
                    disabled={!session}
                  >
                    <FaFlickr /> Connect Flickr
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Export Control Panel */}
        {bothConnected && (
          <div className="control-panel-wrapper animate-fade-in">
            <div className="glass-panel control-panel-card">
              <div className="control-panel-header">
                <h2 className="text-2xl font-bold">Export Control Panel</h2>
                <hr className="control-panel-divider" />
              </div>
              <PhotoGrid />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
