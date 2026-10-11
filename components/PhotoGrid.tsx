'use client';

import { useState, useEffect, useRef } from 'react';
import { FaGoogle, FaFlickr } from 'react-icons/fa';
import { useSession, signIn } from 'next-auth/react';
import { GoogleMediaItem, UploadResult } from '@/types/photos';

function GoogleImage({ src, accessToken, alt, className }: { src: string; accessToken: string; alt: string; className?: string }) {
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;
    let objectUrl = '';

    const loadImage = async () => {
      try {
        const res = await fetch(src, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) throw new Error('Failed to fetch image');
        const blob = await res.blob();
        if (isCancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch (err) {
        console.error('Error loading Google Photos image:', err);
      }
    };

    if (src && accessToken) {
      loadImage();
    }

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, accessToken]);

  if (!imageSrc) {
    return <div className="w-full h-full bg-gray-800 animate-pulse flex items-center justify-center text-xs text-gray-500">Loading...</div>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc} alt={alt} className={className} />;
}

const DEFAULT_POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 1000;
const FALLBACK_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

// Parses a Google API duration string such as "5s" or "1.5s" into milliseconds.
function parseDurationMs(duration: unknown): number | null {
  if (typeof duration !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration);
  return match ? Math.round(parseFloat(match[1]) * 1000) : null;
}

export default function PhotoGrid() {
  const { data: session } = useSession();
  const googleAccessToken = session?.accessToken as string;
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pickerWindowRef = useRef<Window | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<GoogleMediaItem[]>([]);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    status: 'idle' | 'uploading' | 'completed' | 'error';
    total: number;
    uploaded: number;
    failed: string[];
    currentPhotoName: string;
  }>({
    status: 'idle',
    total: 0,
    uploaded: 0,
    failed: [],
    currentPhotoName: ''
  });

  const startPicker = async () => {
    setLoading(true);
    setUploadResult(null);
    setPickerUri(null);
    setUploadProgress({
      status: 'idle',
      total: 0,
      uploaded: 0,
      failed: [],
      currentPhotoName: ''
    });

    // Open the popup synchronously, while we still have the click's user gesture.
    // Opening it after the fetch below gets it blocked by Safari and most mobile browsers.
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      '',
      'google-photos-picker',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    pickerWindowRef.current = popup;

    try {
      const res = await fetch('/api/photos', { method: 'POST' });
      
      if (res.status === 401) {
        popup?.close();
        setUploadResult("Google connection expired. Redirecting to sign in...");
        setTimeout(() => {
          signIn('google');
        }, 1500);
        return;
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create picker session');
      }

      const uri = `${data.pickerUri}/autoclose`;
      if (popup && !popup.closed) {
        popup.location.href = uri;
      }

      setPickerUri(uri);
      setSessionId(data.id);
      setIsPicking(true);
      
    } catch (err) {
      popup?.close();
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
      setUploadResult(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };


  // Close the popup window if the component unmounts
  useEffect(() => {
    return () => {
      if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
        pickerWindowRef.current.close();
      }
    };
  }, []);

  // Poll the picker session until Google reports a selection or the session expires.
  // Note: we can't use the popup's `closed` flag for this. The Google Photos picker sets a
  // Cross-Origin-Opener-Policy that severs the opener link, so `closed` reads true while
  // the user is still picking.
  useEffect(() => {
    if (!sessionId || !isPicking) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;
    let consecutiveErrors = 0;
    let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
    let deadline = Date.now() + FALLBACK_SESSION_TIMEOUT_MS;

    const stop = (message: string | null) => {
      setIsPicking(false);
      setUploadResult(message);
    };

    const scheduleNext = () => {
      if (Date.now() > deadline) {
        stop('The Google Photos picker session expired before a selection was received. Please try again.');
        return;
      }
      timeoutId = setTimeout(poll, pollIntervalMs);
    };

    const handleError = (message: string) => {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        stop(`Error: ${message}`);
      } else {
        scheduleNext();
      }
    };

    const poll = async () => {
      if (isCancelled) return;
      
      try {
        const res = await fetch(`/api/photos/poll?sessionId=${sessionId}`);
        if (isCancelled) return;

        if (res.status === 401) {
           stop("Google connection expired. Redirecting to sign in...");
           setTimeout(() => {
             signIn('google');
           }, 1500);
           return;
        }

        const data = await res.json();
        if (isCancelled) return;

        if (res.status === 202) {
           consecutiveErrors = 0;
           const interval = parseDurationMs(data.pollInterval);
           if (interval) pollIntervalMs = Math.max(interval, MIN_POLL_INTERVAL_MS);
           const expireTime = data.expireTime ? Date.parse(data.expireTime) : NaN;
           if (!Number.isNaN(expireTime)) deadline = expireTime;
           scheduleNext();
           return;
        }

        if (!res.ok) {
           handleError(data.error || `Polling failed with status ${res.status}`);
           return;
        }

        if (data.mediaItems && data.mediaItems.length > 0) {
           setIsPicking(false);
           setSelectedPhotos(data.mediaItems);
           setUploadResult(`You selected ${data.mediaItems.length} photos! Ready to upload.`);
        } else {
           stop('No photos were selected.');
        }
      } catch (e) {
         if (isCancelled) return;
         console.error("Polling error:", e);
         handleError(e instanceof Error ? e.message : 'Network error while checking selection');
      }
    };

    poll();
    
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sessionId, isPicking]);

  const runUploadQueue = async (photosToUpload: GoogleMediaItem[]) => {
    setUploading(true);
    setUploadResult(null);
    
    const total = photosToUpload.length;

    setUploadProgress({
      status: 'uploading',
      total,
      uploaded: 0,
      failed: [],
      currentPhotoName: ''
    });

    const queue = [...photosToUpload];
    const CONCURRENCY = 2; // Concurrency limit of 2 parallel uploads

    const worker = async () => {
      while (queue.length > 0) {
        const photo = queue.shift();
        if (!photo) break;

        const filename = photo.mediaFile ? photo.mediaFile.filename : photo.filename;
        setUploadProgress(prev => ({
          ...prev,
          currentPhotoName: filename
        }));

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ photos: [photo] }),
          });

          if (res.status === 401) {
            setUploadProgress(prev => ({
              ...prev,
              status: 'error'
            }));
            setUploadResult("Google connection expired. Redirecting to sign in...");
            setTimeout(() => {
              signIn('google');
            }, 1500);
            return;
          }

          if (!res.ok) {
            throw new Error(`Upload failed: status ${res.status}`);
          }

          const data: UploadResult = await res.json();
          if (data.uploaded > 0) {
            setUploadProgress(prev => ({
              ...prev,
              uploaded: prev.uploaded + 1
            }));
          } else {
            setUploadProgress(prev => ({
              ...prev,
              failed: [...prev.failed, filename]
            }));
          }
        } catch (err) {
          console.error(`Upload error for ${filename}:`, err);
          setUploadProgress(prev => ({
            ...prev,
            failed: [...prev.failed, filename]
          }));
        }
      }
    };

    const workers = Array(Math.min(CONCURRENCY, queue.length))
      .fill(null)
      .map(() => worker());

    await Promise.all(workers);

    setUploadProgress(prev => ({
      ...prev,
      status: 'completed',
      currentPhotoName: ''
    }));
    
    setUploading(false);
  };

  const handleUpload = async () => {
    await runUploadQueue(selectedPhotos);
  };

  const handleRetryFailed = async () => {
    const failedPhotos = selectedPhotos.filter(p => {
      const filename = p.mediaFile ? p.mediaFile.filename : p.filename;
      return uploadProgress.failed.includes(filename);
    });
    if (failedPhotos.length > 0) {
      await runUploadQueue(failedPhotos);
    }
  };

  const handleDone = () => {
    setSelectedPhotos([]);
    setUploadProgress({
      status: 'idle',
      total: 0,
      uploaded: 0,
      failed: [],
      currentPhotoName: ''
    });
  };

  return (
    <div className="w-full mt-2">
      {!selectedPhotos.length ? (
        <div className="picker-container">
          <p className="picker-text">Open your Google Photos library to select the images you want to transfer.</p>
          <button 
            className={`btn btn-google w-full ${loading ? 'btn-disabled' : ''}`}
            onClick={startPicker}
            disabled={loading}
          >
            <FaGoogle /> {loading ? 'Initializing Picker...' : 'Select Photos from Google'}
          </button>
          
          {isPicking && (
             <div className="mt-5 flex flex-col items-center gap-3">
                <p className="text-sm text-yellow-500 animate-pulse">
                  Waiting for your selection in Google Photos. Click &quot;Done&quot; in the picker when you&apos;re finished.
                </p>
                {pickerUri && (
                  <a
                    href={pickerUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 underline"
                  >
                    Picker didn&apos;t open? Open it here
                  </a>
                )}
                <button 
                  className="btn btn-gray text-xs px-3 py-1.5"
                  onClick={() => {
                    setIsPicking(false);
                    setUploadResult(null);
                  }}
                >
                  Cancel & Reset
                </button>
             </div>
          )}

          {uploadResult && !isPicking && (
             <div className="status-success-card">
                {uploadResult}
             </div>
          )}
        </div>
      ) : (
        <div className="preview-container">
           {uploadProgress.status === 'idle' && (
             <>
               <div className="transfer-status-row">
                  <span className="text-sm text-gray-400">Ready to transfer:</span>
                  <span className="flickr-badge">{selectedPhotos.length} {selectedPhotos.length === 1 ? 'photo' : 'photos'}</span>
               </div>
               
               <div className="thumbnail-grid">
                  {selectedPhotos.slice(0, 4).map(p => {
                     const thumbUrl = p.mediaFile ? p.mediaFile.baseUrl : p.baseUrl;
                     return (
                        <div key={p.id} className="thumbnail-item">
                           <GoogleImage 
                             src={`${thumbUrl}=w100-h100-c`} 
                             accessToken={googleAccessToken} 
                             alt="thumbnail" 
                           />
                        </div>
                     );
                  })}
                  {selectedPhotos.length > 4 && (
                     <div className="aspect-square flex items-center justify-center bg-gray-900/60 rounded-lg border border-gray-800 text-gray-400 text-sm font-semibold">
                        +{selectedPhotos.length - 4}
                     </div>
                  )}
               </div>
               
               {uploadResult && (
                 <div className="status-success-card">
                   {uploadResult}
                 </div>
               )}
               
               <button 
                  className={`btn btn-flickr w-full glowing-btn ${uploading ? 'btn-disabled' : ''}`}
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  <FaFlickr /> {uploading ? 'Uploading to Flickr...' : 'Confirm Upload to Flickr'}
                </button>
             </>
           )}

           {uploadProgress.status === 'uploading' && (
             <div className="progress-card">
               <div className="progress-title">Transferring to Flickr...</div>
               <div className="progress-bar-container">
                 <div 
                   className="progress-bar-fill" 
                   style={{ width: `${(uploadProgress.uploaded / uploadProgress.total) * 100}%` }}
                 ></div>
               </div>
               <div className="progress-status-text font-medium text-slate-300">
                 Transferred {uploadProgress.uploaded} of {uploadProgress.total} photos
               </div>
               {uploadProgress.currentPhotoName && (
                 <div className="text-xs text-gray-500 mt-3 truncate w-full px-4">
                   Uploading: {uploadProgress.currentPhotoName}
                 </div>
               )}
               {uploadProgress.failed.length > 0 && (
                 <div className="text-xs text-red-400 mt-2 font-semibold animate-pulse">
                   {uploadProgress.failed.length} failed
                 </div>
               )}
             </div>
           )}

           {uploadProgress.status === 'completed' && (
             <div className="progress-card">
               <div className="progress-title">
                 {uploadProgress.failed.length === 0 ? 'Transfer Complete! 🎉' : 'Transfer Completed with Errors ⚠️'}
               </div>
               
               <div className="progress-bar-container">
                 <div 
                   className="progress-bar-fill" 
                   style={{ width: '100%' }}
                 ></div>
               </div>

               <div className="progress-status-text font-medium text-slate-300">
                 {uploadProgress.failed.length === 0 
                   ? `Successfully transferred all ${uploadProgress.total} photos!` 
                   : `Transferred ${uploadProgress.uploaded} of ${uploadProgress.total} photos (${uploadProgress.failed.length} failed)`}
               </div>

               {uploadProgress.failed.length > 0 && (
                 <div className="failed-photos-list">
                   <div className="failed-photos-list-title">Failed Uploads</div>
                   {uploadProgress.failed.map((filename, idx) => (
                     <div key={idx} className="failed-photo-item" title={filename}>
                       • {filename}
                     </div>
                   ))}
                 </div>
               )}

               <div className="flex flex-col gap-3 mt-6">
                 {uploadProgress.failed.length > 0 && (
                   <button 
                     className="btn btn-flickr w-full glowing-btn"
                     onClick={handleRetryFailed}
                   >
                     Retry Failed ({uploadProgress.failed.length})
                   </button>
                 )}
                 <button 
                   className="btn btn-gray w-full"
                   onClick={handleDone}
                 >
                   Done
                 </button>
               </div>
             </div>
            )}
        </div>
      )}
    </div>
  );
}
