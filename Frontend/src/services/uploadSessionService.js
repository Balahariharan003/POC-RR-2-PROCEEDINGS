// Upload Session Service for Mobile QR Petition Capture

const BROADCAST_CHANNEL_NAME = 'petition_qr_sync_channel';

let broadcastChannel = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

/**
 * Generate a random 8-character hexadecimal session ID
 */
export function generateLocalSessionId() {
  const chars = '0123456789abcdef';
  let result = '';

  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }

  return result;
}

/**
 * Create a new upload session
 * Uses the frontend-only Vite demo bridge
 */
export async function createUploadSession() {
  try {
    const res = await fetch('/demo-api/upload/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();

      if (data.sessionId) {
        return {
          sessionId: data.sessionId,
          networkHost: data.networkHost || null
        };
      }
    }
  } catch (err) {
    console.warn(
      'Demo session API unavailable, using local fallback sessionId:',
      err
    );
  }

  // Fallback if demo bridge is unavailable
  const localId = generateLocalSessionId();

  try {
    sessionStorage.setItem(
      `session_init_${localId}`,
      Date.now().toString()
    );
  } catch (e) {
    console.warn(e);
  }

  return {
    sessionId: localId,
    networkHost: null
  };
}

/**
 * Upload captured petition from mobile phone
 *
 * This frontend-only version:
 * 1. Converts the file to a Data URL
 * 2. Sends the file information to the Vite demo bridge
 * 3. The laptop dashboard can then receive it through polling
 *
 * @param {string} sessionId
 * @param {File|Blob} file
 * @param {string} [customFileName]
 */
export async function uploadPetitionImage(
  sessionId,
  file,
  customFileName
) {
  if (!sessionId || !file) {
    throw new Error('Session ID and file are required.');
  }

  const isPdf = Boolean(
    (file.type && file.type === 'application/pdf') ||
    (file.name && file.name.toLowerCase().endsWith('.pdf')) ||
    (customFileName &&
      customFileName.toLowerCase().endsWith('.pdf'))
  );

  const defaultExt = isPdf ? '.pdf' : '.jpg';

  const effectiveFileName =
    customFileName ||
    file.name ||
    `petition_${sessionId}${defaultExt}`;

  const sizeFormatted =
    file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;

  // Convert file to Data URL
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () =>
      reject(new Error('Failed to read the selected file.'));

    reader.readAsDataURL(file);
  });

  const resolvedFileType =
    file.type ||
    (isPdf ? 'application/pdf' : 'image/jpeg');

  const payload = {
    sessionId,
    fileName: effectiveFileName,
    fileSize: sizeFormatted,
    fileType: resolvedFileType,
    isPdf,
    dataUrl,
    uploadedAt: new Date().toISOString()
  };

  // 1. Broadcast locally
  // Useful when laptop and mobile happen to be in the same browser context
  try {
    localStorage.setItem(
      `qr_upload_${sessionId}`,
      JSON.stringify(payload)
    );

    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'PETITION_UPLOADED',
        ...payload
      });
    }
  } catch (err) {
    console.warn(
      'Local broadcast sync warning:',
      err
    );
  }

  // 2. Send to frontend-only Vite demo bridge
  try {
    const res = await fetch('/demo-api/upload/petition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();

      return {
        success: true,
        ...data
      };
    }

    throw new Error(
      `Upload bridge returned HTTP ${res.status}`
    );
  } catch (err) {
    console.error(
      'Demo upload bridge error:',
      err
    );

    throw new Error(
      'Unable to send the document to the laptop.'
    );
  }
}

/**
 * Check upload status for a given session
 *
 * @param {string} sessionId
 */
export async function checkUploadStatus(sessionId) {
  if (!sessionId) {
    return {
      uploaded: false
    };
  }

  // 1. Check local storage first
  try {
    const localRecord = localStorage.getItem(
      `qr_upload_${sessionId}`
    );

    if (localRecord) {
      const parsed = JSON.parse(localRecord);

      return {
        uploaded: true,
        ...parsed
      };
    }
  } catch {
    // Ignore storage errors
  }

  // 2. Check frontend-only Vite demo bridge
  try {
    const res = await fetch(
      `/demo-api/upload/status/${sessionId}`,
      {
        cache: 'no-store'
      }
    );

    if (res.ok) {
      const data = await res.json();

      if (data.uploaded) {
        return {
          uploaded: true,
          sessionId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          fileType: data.fileType,
          isPdf: data.isPdf,
          dataUrl: data.dataUrl,
          uploadedAt: data.uploadedAt
        };
      }
    }
  } catch {
    // Network errors during polling are ignored
  }

  return {
    uploaded: false,
    sessionId
  };
}

/**
 * Listen for upload completion using:
 * - BroadcastChannel
 * - Storage events
 * - Vite demo bridge polling
 *
 * @param {string} sessionId
 * @param {Function} onUploaded
 * @returns {Function} unsubscribe cleanup function
 */
export function subscribeToUpload(
  sessionId,
  onUploaded
) {
  let isDone = false;

  let pollInterval;

  const handleSuccess = (data) => {
    if (isDone) {
      return;
    }

    isDone = true;

    clearInterval(pollInterval);

    if (broadcastChannel) {
      broadcastChannel.removeEventListener(
        'message',
        handleBroadcast
      );
    }

    window.removeEventListener(
      'storage',
      handleStorage
    );

    onUploaded(data);
  };

  const handleBroadcast = (event) => {
    if (
      event.data &&
      event.data.type === 'PETITION_UPLOADED' &&
      event.data.sessionId === sessionId
    ) {
      handleSuccess(event.data);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener(
      'message',
      handleBroadcast
    );
  }

  const handleStorage = (event) => {
    if (
      event.key === `qr_upload_${sessionId}` &&
      event.newValue
    ) {
      try {
        const data = JSON.parse(
          event.newValue
        );

        handleSuccess(data);
      } catch (err) {
        console.warn(
          'Storage parse error:',
          err
        );
      }
    }
  };

  window.addEventListener(
    'storage',
    handleStorage
  );

  // Poll laptop's Vite demo bridge
  pollInterval = setInterval(
    async () => {
      if (isDone) {
        return;
      }

      const status =
        await checkUploadStatus(sessionId);

      if (
        status &&
        status.uploaded
      ) {
        handleSuccess(status);
      }
    },
    1200
  );

  // Check immediately
  checkUploadStatus(sessionId).then(
    (status) => {
      if (
        status &&
        status.uploaded
      ) {
        handleSuccess(status);
      }
    }
  );

  return () => {
    isDone = true;

    clearInterval(pollInterval);

    if (broadcastChannel) {
      broadcastChannel.removeEventListener(
        'message',
        handleBroadcast
      );
    }

    window.removeEventListener(
      'storage',
      handleStorage
    );
  };
}

/**
 * Cleanup session data
 */
export function cleanupUploadSession(
  sessionId
) {
  if (!sessionId) {
    return;
  }

  try {
    localStorage.removeItem(
      `qr_upload_${sessionId}`
    );

    sessionStorage.removeItem(
      `session_init_${sessionId}`
    );
  } catch {
    // Ignore cleanup errors
  }
}