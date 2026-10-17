# FocusTogether — Distraction-Free Group Study (Starter Prototype)

A responsive browser-based prototype for a college web-development project.

## Features working in this prototype
- Dashboard with study statistics and recent weekly focus chart
- Create study groups and generate invitation codes
- Add and complete study tasks
- Schedule study sessions and show in-app/browser reminders
- Pomodoro-style focus timer and browser-local study-time tracking
- Save notes and upload images, text files, and PDFs (local browser storage; PDFs are listed but not rendered)
- AI study assistant powered by OpenAI through an authenticated Supabase Edge Function
- Focus mode that hides navigation clutter
- LiveKit audio/video study calls with camera, microphone, and screen-share controls
- LiveKit group study rooms with participant video tiles, room status/count, speaker playback mute, and leave-room controls
- Edit your display name, profile photo, and bio (saved in this browser)

## Important limitations
This is a front-end prototype, not a production-ready multi-user service.
- Data is stored in the current browser's `localStorage`; it does not sync across students or devices.
- Profile changes are browser-local and are not synced to Supabase or other devices.
- Study groups and their invite codes remain browser-local; call participants can join by sharing the code, but this does not sync group membership or data across accounts.
- The AI assistant requires an OpenAI API key configured as a Supabase server-side secret.
- Calls use LiveKit for realtime audio/video and Supabase Edge Functions to issue short-lived access tokens. Room codes are not access control, so only share them with people you trust.
- Reminders work while the page is open. Reliable reminders while the browser is closed require push notifications and server-side scheduling.
- File uploads are local and should be kept small. A production version needs private cloud storage and access policies.

## Run it
1. Extract the ZIP.
2. Open the `focustogether_app` folder in VS Code.
3. For best results, use the VS Code Live Server extension, or run any local static web server from this folder.
4. Open `index.html` through `http://localhost` rather than directly from the file system for browser permissions and notifications.
5. Camera, microphone, and screen capture generally require `localhost` or HTTPS and user permission.

## Audio/video study calls (LiveKit)
1. Set the LiveKit server URL in `LIVEKIT_SERVER_URL` in `app.js`. The current value is the project's public `wss://` URL; it is not an API secret.
2. Install the Supabase CLI, link it to this Supabase project, and set the LiveKit credentials as **server-side Supabase secrets**:
   ```sh
   supabase secrets set LIVEKIT_API_KEY=your_api_key LIVEKIT_API_SECRET=your_api_secret
   supabase functions deploy create-livekit-token
   ```
   Do not add the API secret to `app.js`, HTML, or any browser-visible configuration. The Edge Function validates the signed-in Supabase user and creates a one-hour, room-scoped LiveKit token.
3. Confirm Supabase Auth is configured and the project can deploy Edge Functions. The `create-livekit-token` function uses the project's `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment values.
4. Create a study group and share its invite code. Users enter that code in **Room code**; group metadata remains browser-local in this prototype. Calls need a signed-in account.
5. Open **Room** from a group (or **Join room** from a scheduled session), allow browser camera/microphone permission, then share the same code with other users. All participants must use HTTPS or `localhost`.

Room codes are bearer codes, not server-side group membership checks: anyone who knows a code and has an account in this Supabase project can request a token for that room. Do not use this prototype for private or regulated calls without adding server-side authorization and abuse controls.

## AI study assistant (OpenAI)
1. In the Supabase dashboard or with the Supabase CLI, set `OPENAI_API_KEY` as a **server-side secret**. For example:
   ```sh
   supabase secrets set OPENAI_API_KEY=your_openai_api_key
   ```
2. Deploy the `study-ai` Edge Function:
   ```sh
   supabase functions deploy study-ai
   ```
3. The assistant requires a signed-in Supabase user. The browser sends the conversation to the Edge Function using the user's Supabase session; the function verifies the session and calls OpenAI using the server-side secret.
4. Never put the OpenAI API key in `app.js`, `auth.js`, HTML, or any other browser-visible file. If the secret is missing or the service is unavailable, the assistant shows an error instead of returning a sample response.

## Supabase Auth setup
1. Create a Supabase project at https://supabase.com.
2. Open the Supabase dashboard and copy your project URL and anon public key.
3. In `auth.js`, replace the placeholder values:
   - `https://YOUR_PROJECT_REF.supabase.co`
   - `YOUR_SUPABASE_ANON_KEY`
4. In Supabase Auth > Settings, enable Email authentication.
5. If you want to require email confirmation, leave the default sign-up setting enabled.
6. In Supabase Auth > URL Configuration, add the app's local or deployed URL to the Redirect URLs allow list. For example, with VS Code Live Server this is often `http://127.0.0.1:5500/**` (use the URL and port shown in your browser).
7. Use “Forgot password?” on the login screen. The email link returns to the app, where the user can set a new password. Run the app on localhost or HTTPS; opening `index.html` directly as a `file://` URL is not supported for auth redirects.

## Supabase Storage setup for private user and group files
1. In the Supabase dashboard, open Storage.
2. Create a private bucket named `user-private`.
3. Create another private bucket named `group-private`.
4. In each bucket, set the access policy so only authenticated users can upload and read their own files.
5. Example folder structure:
   - `users/<user-id>/...`
   - `groups/<group-id>/...`
6. For production security, use RLS policies rather than open public access.

Use the file `supabase-storage-rls.sql` in the project root to paste into the Supabase SQL editor.

This starter app uploads attachments to those buckets when an authenticated user is logged in. If the bucket does not exist or the user is logged out, the upload stays local in browser storage and the app keeps working without crashing.

## Suggested next steps for the team
1. Add a React/Vite project structure.
2. Connect Supabase Auth and PostgreSQL with row-level security.
3. Store uploads in private Supabase Storage buckets.
4. Add a secure server-side AI endpoint and never expose API keys in browser code.
5. Add server-side membership checks and call moderation to LiveKit token issuance.
6. Add automated tests, responsive QA, privacy documentation, and deployment.

## Suggested team split (4 people)
- Member 1: UI/UX and styling
- Member 2: groups, tasks, and sessions
- Member 3: backend/database and security integration
- Member 4: AI, communication integration, testing, and documentation
