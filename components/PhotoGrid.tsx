'use client';

import { useState, useEffect, useRef } from 'react';
import { FaGoogle, FaFlickr } from 'react-icons/fa';
import { GoogleMediaItem, UploadResult } from '@/types/photos';

export default function PhotoGrid() {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pickerWindowRef = useRef<Window | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<GoogleMediaItem[]>([]);
  const [isPopupActive, setIsPopupActive] = useState(false);

  const startPicker = async () => {
    setLoading(true);
    setUploadResult(null);
    try {
      const res = await fetch('/api/photos', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create picker session');
      }

      setSessionId(data.id);
      
      // Open the picker URI in a popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        `${data.pickerUri}/autoclose`, 
        'Google Photos Picker', 
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      pickerWindowRef.current = popup;
      setIsPicking(true);
      setIsPopupActive(true);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
      setUploadResult(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    // Check popup status every second
    const popupCheckInterval = setInterval(() => {
      if (pickerWindowRef.current?.closed) {
        setIsPopupActive(false);
      }
    }, 1000);

    const poll = async () => {
      if (isCancelled || !sessionId || !isPicking) return;
      
      try {
        const res = await fetch(`/api/photos/poll?sessionId=${sessionId}`);
        
        // Check if cancelled after the async operation
        if (isCancelled) return;

        if (res.status === 202) {
           if (pickerWindowRef.current?.closed) {
              setIsPicking(false);
              setUploadResult('Picker window was closed before selection was complete.');
              return;
           }
           timeoutId = setTimeout(poll, 3000);
           return;
        }

        const data = await res.json();
        
        // Re-check cancellation after parsing json
        if (isCancelled) return;

        if (res.ok && data.mediaItems && data.mediaItems.length > 0) {
          setIsPicking(false);
          setSelectedPhotos(data.mediaItems);
          setUploadResult(`You selected ${data.mediaItems.length} photos! Ready to upload.`);
        } else if (res.ok) {
          setIsPicking(false);
          setUploadResult(`Selection finished but no photos found. Raw data: ${JSON.stringify(data)}`);
        } else {
          if (pickerWindowRef.current?.closed) {
             setIsPicking(false);
             setUploadResult(`Error fetching selection: ${data.error || 'Unknown error'}`);
          } else {
             timeoutId = setTimeout(poll, 3000);
          }
        }
      } catch (e) {
         if (isCancelled) return;
         console.error("Polling error:", e);
         if (pickerWindowRef.current?.closed) {
           setIsPicking(false);
         } else {
           timeoutId = setTimeout(poll, 3000);
         }
      }
    };

    if (sessionId && isPicking) {
      poll();
    }
    
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(popupCheckInterval);
      // Close the popup window if it's still open when component unmounts
      if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
        pickerWindowRef.current.close();
      }
    };
  }, [sessionId, isPicking]);

  const handleUpload = async () => {
    setUploading(true);
    setUploadResult('Uploading to Flickr...');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photos: selectedPhotos }),
      });
      const data: UploadResult = await res.json();
      
      if (res.ok) {
        let msg = `Successfully uploaded ${data.uploaded} out of ${data.total} photos!`;
        if (data.failed && data.failed.length > 0) {
          msg += ` Failed: ${data.failed.join(', ')}`;
        }
        setUploadResult(msg);
        setSelectedPhotos([]); // clear selection
      } else {
        // Fallback if data doesn't match expected error shape
        const errorMsg = (data as unknown as { error?: string }).error || 'Upload failed';
        setUploadResult(`Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadResult('Upload failed due to network error.');
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 mt-8">
      {!selectedPhotos.length ? (
        <div className="glass-panel w-full max-w-lg text-center animate-fade-in">
          <p className="mb-6">Click the button below to securely open Google Photos and select the images you want to export.</p>
          <button 
            className={`btn btn-google w-full ${loading ? 'btn-disabled' : ''}`}
            onClick={startPicker}
            disabled={loading}
          >
            <FaGoogle /> {loading ? 'Initializing Picker...' : 'Select Photos from Google'}
          </button>
          
          {isPicking && isPopupActive && (
             <p className="mt-4 text-sm text-yellow-300">Waiting for you to finish selecting photos in the popup window...</p>
          )}
        </div>
      ) : (
        <div className="glass-panel w-full max-w-lg text-center animate-fade-in">
           <h3 className="text-xl font-bold mb-4">{selectedPhotos.length} Photos Ready</h3>
           <div className="grid grid-cols-4 gap-2 mb-6">
              {selectedPhotos.slice(0, 4).map(p => {
                 const thumbUrl = p.mediaFile ? p.mediaFile.baseUrl : p.baseUrl;
                 return (
                   <div key={p.id} className="aspect-square bg-gray-800 rounded-lg overflow-hidden">
                      <img src={`${thumbUrl}=w100-h100-c`} alt="thumbnail" className="w-full h-full object-cover" />
                   </div>
                 );
              })}
              {selectedPhotos.length > 4 && (
                 <div className="aspect-square flex items-center justify-center text-gray-400 text-xs">
                    +{selectedPhotos.length - 4} more
                 </div>
              )}
           </div>
           
           <button 
              className={`btn btn-flickr w-full ${uploading ? 'btn-disabled' : ''}`}
              onClick={handleUpload}
              disabled={uploading}
            >
              <FaFlickr /> {uploading ? 'Uploading...' : 'Confirm Upload to Flickr'}
            </button>
        </div>
      )}

      {uploadResult && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 glass-panel animate-fade-in bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 whitespace-nowrap">
          {uploadResult}
        </div>
      )}
    </div>
  );
}
