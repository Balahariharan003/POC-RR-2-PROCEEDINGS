import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const uploadSessions = new Map();

function demoUploadBridge() {
  return {
    name: 'demo-upload-bridge',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(
          req.url || '/',
          'http://localhost'
        );

        // Create upload session
        if (
          req.method === 'POST' &&
          url.pathname === '/demo-api/upload/session'
        ) {
          const sessionId = Math.random()
            .toString(16)
            .substring(2, 10);

          uploadSessions.set(sessionId, {
            sessionId,
            uploaded: false
          });

          res.statusCode = 200;
          res.setHeader(
            'Content-Type',
            'application/json'
          );

          res.end(
            JSON.stringify({
              sessionId,
              networkHost: null
            })
          );

          return;
        }

        // Receive uploaded petition
        if (
          req.method === 'POST' &&
          url.pathname === '/demo-api/upload/petition'
        ) {
          let body = '';

          req.on('data', (chunk) => {
            body += chunk.toString();
          });

          req.on('end', () => {
            try {
              const data = JSON.parse(body);

              const session =
                uploadSessions.get(data.sessionId);

              if (!session) {
                res.statusCode = 404;
                res.setHeader(
                  'Content-Type',
                  'application/json'
                );

                res.end(
                  JSON.stringify({
                    error: 'Session not found'
                  })
                );

                return;
              }

              session.uploaded = true;
              session.fileName = data.fileName;
              session.fileSize = data.fileSize;
              session.fileType = data.fileType;
              session.isPdf = data.isPdf;
              session.dataUrl = data.dataUrl;
              session.uploadedAt = data.uploadedAt;

              console.log(
                `\n📱 Petition received: ${data.fileName}`
              );

              res.statusCode = 200;
              res.setHeader(
                'Content-Type',
                'application/json'
              );

              res.end(
                JSON.stringify({
                  success: true,
                  ...session
                })
              );
            } catch (error) {
              console.error(
                'Upload bridge error:',
                error
              );

              res.statusCode = 400;
              res.setHeader(
                'Content-Type',
                'application/json'
              );

              res.end(
                JSON.stringify({
                  error: 'Invalid upload data'
                })
              );
            }
          });

          return;
        }

        // Check upload status
        if (
          req.method === 'GET' &&
          url.pathname.startsWith(
            '/demo-api/upload/status/'
          )
        ) {
          const sessionId =
            url.pathname.split('/').pop();

          const session =
            uploadSessions.get(sessionId);

          res.statusCode = 200;
          res.setHeader(
            'Content-Type',
            'application/json'
          );

          if (!session) {
            res.end(
              JSON.stringify({
                uploaded: false,
                sessionId
              })
            );

            return;
          }

          res.end(
            JSON.stringify(session)
          );

          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    demoUploadBridge()
  ],

  server: {
    port: 5173,
    host: true
  }
});