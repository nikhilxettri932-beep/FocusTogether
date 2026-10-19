# FocusTogether — Distraction-Free Group Study (Starter Prototype)

A responsive browser-based prototype for a college web-development project.

## Features working in this prototype
- Dashboard with study statistics and recent weekly focus chart
- Create study groups and generate invitation codes
- Add and complete study tasks
- Schedule study sessions and show in-app/browser reminders
- Pomodoro-style focus timer and browser-local study-time tracking
- Save personal notes locally, or share notes, tasks, and uploaded files with study-group members
- AI study assistant powered by Gemini through an authenticated Supabase Edge Function
- Focus mode that hides navigation clutter
- LiveKit audio/video study calls with camera, microphone, and screen-share controls
- LiveKit group study rooms with participant video tiles, room status/count, speaker playback mute, and leave-room controls
- Edit your display name, profile photo, and bio (saved in this browser)

## Important limitations
This is a front-end prototype, not a production-ready multi-user service.
- Personal tasks, notes, sessions, and profile settings are stored in the current browser. Group tasks, notes, and uploaded files sync through Supabase after setup.
- Profile changes are browser-local and are not synced to Supabase or other devices.
- Study group details, membership, group tasks, group notes, and group uploads sync across accounts after the database and Storage setup below. Scheduled sessions and profile changes remain browser-local.
- The AI assistant requires a Gemini API key configured as a Supabase server-side secret.
- Calls use LiveKit for realtime audio/video and Supabase Edge Functions to issue short-lived tokens. The function verifies group membership and derives a private room from the group ID; invite codes alone cannot authorize a call.
- Reminders work while the page is open. Reliable reminders while the browser is closed require push notifications and server-side scheduling.
- File uploads are local and should be kept small. A production version needs private cloud storage and access policies.

## Run it
1. Extract the ZIP.
2. Open the `focustogether_app` folder in VS Code.
3. For best results, use the VS Code Live Server extension, or run any local static web server from this folder.
4. Open `index.html` through `http://localhost` rather than directly from the file system for browser permissions and notifications.
5. Camera, microphone, and screen capture generally require `localhost` or HTTPS and user permission.

## Create and join study groups
1. In the Supabase dashboard, open **SQL Editor** and run [`supabase/groups.sql`](./supabase/groups.sql). This creates the shared groups, member-only tasks and notes, and secure create/join/list functions.
2. Create private Storage buckets named `user-private` and `group-private`, then run [`supabase-storage-rls.sql`](./supabase-storage-rls.sql) to apply the private-file access policies.
3. Publish the updated `app.js`, `index.html`, and `auth.js` files to GitHub Pages. Users must be signed in to create or join groups.
4. A user creates a group and shares its invite code. Other users choose **Join group**, enter that code, and can add group tasks and notes, upload resources, and open the group's call room.
5. Groups created before this shared-group setup were saved only in their creator's browser. Re-create them after running the SQL so other accounts can join. Scheduled sessions remain browser-local.

## Audio/video study calls (LiveKit)
1. Set the LiveKit server URL in `LIVEKIT_SERVER_URL` in `app.js`. The current value is the project's public `wss://` URL; it is not an API secret.
2. Install the Supabase CLI, link it to this Supabase project, and set the LiveKit credentials as **server-side Supabase secrets**:
   ```sh
   npx supabase@latest secrets set LIVEKIT_API_KEY=your_api_key LIVEKIT_API_SECRET=your_api_secret
   npx supabase@latest functions deploy create-livekit-token
   ```
   Do not add the API secret to `app.js`, HTML, or any browser-visible configuration. The Edge Function validates the signed-in Supabase user and group membership, then creates a one-hour LiveKit token for that group's room.
3. Confirm Supabase Auth is configured and the project can deploy Edge Functions. The `create-livekit-token` function uses the project's `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment values.
4. Run the latest `supabase/groups.sql` before deploying the token function; the function checks `is_study_group_member` before granting access.
5. Create a study group and share its invite code. Members open **Room** from that group (or enter the same group invite code in the call dialog). All participants must be signed in, belong to the group, and use HTTPS or `localhost`. If a camera or microphone is unavailable, the call can still join using the available device; screen sharing requires browser support and permission.

## AI study assistant (Gemini)
1. In Google AI Studio, create a Gemini API key. In the Supabase dashboard or with the Supabase CLI, set it as the `GEMINI_API_KEY` **server-side secret**. For example:
   ```sh
   npx supabase@latest secrets set GEMINI_API_KEY=your_gemini_api_key
   ```
2. Deploy the `study-ai` Edge Function:
   ```sh
   npx supabase@latest functions deploy study-ai
   ```
3. The assistant requires a signed-in Supabase user. The browser sends the question to the Edge Function using the user's Supabase session; the function verifies the session and calls Gemini using the server-side secret.
4. Never put the Gemini API key in `app.js`, `auth.js`, HTML, or any other browser-visible file. If the secret is missing or the service is unavailable, the assistant shows an error instead of returning a sample response.

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
2. Create private buckets named `user-private` and `group-private`.
3. Run [`supabase-storage-rls.sql`](./supabase-storage-rls.sql) after running [`supabase/groups.sql`](./supabase/groups.sql). Group-file policies grant access only to members of the corresponding group.
4. Example folder structure:
   - `users/<user-id>/...`
   - `groups/<group-id>/...`
6. For production security, use RLS policies rather than open public access.

This starter app uploads group attachments to shared storage and writes their metadata to the shared notes table. If cloud storage is unavailable, the file is retained locally and is not shown as a shared group resource.

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
