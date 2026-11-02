# FocusTogether — Distraction-Free Group Study (Starter Prototype)

A responsive browser-based prototype for a college web-development project.

## Features working in this prototype
- Dashboard with a separate Analysis & Progress page showing daily/weekly/monthly study time, custom-goal completion, study streaks, a calendar heatmap, 7/30-day focus charts, task-based subject and group statistics, and downloadable personal reports
- Create study groups and generate invitation codes
- View friends from shared study groups and see their online/offline status in real time
- Send group chat messages and owner-only announcements
- Let group owners remove members and control members' shared-file access
- Run a synchronized Pomodoro timer with a study group
- Draw together on a group whiteboard; group owners can clear it
- Add and complete study tasks with completion dates in the progress calendar
- Schedule study sessions and show in-app/browser reminders
- Pomodoro-style focus timer and browser-local study-time tracking
- Completed focus-session history synced to Supabase for signed-in users
- Editable personal daily and weekly goals with completion tracking and cloud sync
- Selectable date-range progress reports with focus-time charts, calendar heatmap, and completed task breakdowns
- Dark mode with a saved theme preference
- Save personal notes locally, or share notes, tasks, and uploaded files with study-group members
- Organize study resources into personal or shared group folders; upload and preview private PDFs/images, write notes, and discuss shared resources with member-only comments
- Use a collaborative dotted-grid whiteboard with pen, marker, eraser, personal undo, owner-only clear, and automatic group sync
- Manage group upload, viewing, and delete permissions; Supabase row-level and Storage policies enforce access
- AI study assistant powered by Gemini through an authenticated Supabase Edge Function
- Generate note summaries, multiple-choice practice quizzes, flashcards, and seven-day study plans in English or Hinglish from saved text notes or pasted study material
- Focus mode that hides navigation clutter
- LiveKit audio/video study calls with camera, microphone, and screen-share controls
- LiveKit group study rooms with participant video tiles, room status/count, speaker playback mute, and leave-room controls
- Edit your display name, profile photo, and bio (saved in this browser)

## Important limitations
This is a front-end prototype, not a production-ready multi-user service.
- Personal tasks, notes, scheduled sessions, and profile settings are stored in the current browser. Daily and weekly goal text/completion status and completed focus-session history sync to Supabase for signed-in users; group tasks, notes, and uploaded files sync after setup.
- Subject-wise analytics group completed tasks by their study-group subject. Focus sessions are not currently tagged with a subject, so study-time charts remain unassigned to subjects.
- Profile photos and bios are browser-local; your display name is shared with members of your study groups so they can identify you in the friends list.
- Study group details, membership, tasks, notes, resource folders and comments, chat, shared timers, whiteboards, and uploads sync after the database and Storage setup below. Group owners can restrict members' file access and remove members. Scheduled sessions and profile changes remain browser-local.
- The AI assistant requires a Gemini API key configured as a Supabase server-side secret.
- Calls use LiveKit for realtime audio/video and Supabase Edge Functions to issue short-lived tokens. The function verifies group membership and derives a private room from the group ID; invite codes alone cannot authorize a call.
- Reminders work while the page is open. Reliable reminders while the browser is closed require push notifications and server-side scheduling.
- Personal uploads stay in this browser; group uploads use private Supabase Storage after setup. Keep files reasonably small.

## Run it
1. Extract the ZIP.
2. Open the `focustogether_app` folder in VS Code.
3. For best results, use the VS Code Live Server extension, or run any local static web server from this folder.
4. Open `index.html` through `http://localhost` rather than directly from the file system for browser permissions and notifications.
5. Camera, microphone, and screen capture generally require `localhost` or HTTPS and user permission.

## Create and join study groups
1. In the Supabase dashboard, open **SQL Editor** and run (or rerun) [`supabase/groups.sql`](./supabase/groups.sql). This creates the shared groups, member-only tasks, notes, resource folders and comments, chat, shared group timers and whiteboards, secure create/join/list functions, friend profiles and UID-based friend requests, personal goals and focus history, task completion timestamps, group-owner management functions, and group-member/friend-only Realtime presence policies. Any signed-in user can search an exact public friend UID; friend names and photos are returned for search results, while internal account UUIDs are not displayed as friend IDs. Profile name, bio, and photo are saved to the profile table and restored when the user signs in. Ensure Realtime is enabled for the project.
2. Create private Storage buckets named `user-private` and `group-private`, then run (or rerun) [`supabase-storage-rls.sql`](./supabase-storage-rls.sql) to apply the private-file access policies. Group owners can manage members and allow or restrict member uploads, file viewing, and file deletion; the policies are enforced by Supabase, not just the UI.
3. Publish the updated `app.js`, `index.html`, and `auth.js` files to GitHub Pages. Users must be signed in to create or join groups.
4. A user creates a group and shares its invite code. Other users choose **Join group**, enter that code, and can chat, draw on the shared whiteboard, use the group's focus timer, share notes, tasks and uploads, organize materials into shared folders, comment on resources, open the group's call room, and see group members' online status from **Friends**. Group owners can mark chat posts as announcements, manage members, set file permissions and clear the whiteboard. People who share a study group appear as study contacts; UID-added friends appear after accepting a friend request.
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
5. In **AI study assistant**, choose a study tool and answer language. You can select a saved text note, paste material, load a `.txt`, `.md`, or `.csv` file (up to 2 MB; up to 12,000 characters are sent to the AI), or attach a JPEG, PNG, WebP, or GIF image up to 3 MB and ask a question or create a summary, quiz, or flashcards from it. PDF files are not extracted by the browser yet; paste their text or use a text export. Redeploy `study-ai` after changing the Edge Function.

6. In **Friends**, copy your public friend UID and share it with someone. Search an exact UID to view that user's display name and profile photo, send a friend request, and accept incoming requests. Accepted friends can see one another's online status, even without sharing a study group. A user's profile name, public friend UID, and profile photo are searchable by any signed-in account; the Supabase account UUID is not used as the public friend UID.

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

This starter app uploads group attachments to private shared storage and writes their metadata to the shared notes table. Group upload failures are reported; files selected for a group are never silently stored as personal files. Personal files without cloud storage stay in this browser (1 MB maximum); cloud uploads are limited to 4 MB. Shared folders and note comments require the latest `groups.sql` schema. The collaborative whiteboard stores strokes and syncs them between group members; it is a drawing canvas, not an infinite-canvas document editor.

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
