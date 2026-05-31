'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { FaGoogle, FaFlickr, FaSignOutAlt } from 'react-icons/fa';
import PhotoGrid from '@/components/PhotoGrid';

export default function Home() {
  const { data: session } = useSession();
  const [hasFlickrToken, setHasFlickrToken] = useState(false);

  useEffect(() => {
    // Check if we have a Flickr token cookie (this is a simplified check, 
    // ideally the server should tell us or we check an API route)
    const checkFlickr = async () => {
      try {
        const res = await fetch('/api/flickr/status');
        if (res.ok) {
          const data = await res.json();
          setHasFlickrToken(data.connected);
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkFlickr();
  }, []);

  // if (status === 'loading') {
  //   return <div className="container flex justify-center items-center h-screen">Loading...</div>;
  // }

  return (
    <main className="container animate-fade-in">
      <div className="header">
        <h1>Photos to Flickr</h1>
        <p>Seamlessly export your Google Photos directly to your Flickr photostream.</p>
      </div>

      <div className="flex flex-col items-center gap-8 mt-12">
        <div className="glass-panel w-full max-w-md text-center">
          <h2 className="text-xl font-semibold mb-6">Step 1: Connect Google</h2>
          {session ? (
            <div className="flex flex-col items-center gap-4">
              <div className="text-green-400 font-medium flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Connected as {session.user?.name}
              </div>
              <button 
                className="btn bg-gray-700 hover:bg-gray-600 text-sm px-3 py-1"
                onClick={() => signOut()}
              >
                <FaSignOutAlt /> Sign Out
              </button>
            </div>
          ) : (
            <button className="btn btn-google w-full" onClick={() => signIn('google')}>
              <FaGoogle /> Connect Google Photos
            </button>
          )}
        </div>

        <div className="glass-panel w-full max-w-md text-center">
          <h2 className="text-xl font-semibold mb-6">Step 2: Connect Flickr</h2>
          {hasFlickrToken ? (
            <div className="text-green-400 font-medium flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              Flickr Connected
            </div>
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

      {session && hasFlickrToken && (
        <div className="mt-16 w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-4">You&apos;re all set!</h2>
            <p>Select the photos you want to export.</p>
          </div>
          <PhotoGrid />
        </div>
      )}
    </main>
  );
}
