import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse({ error: "A signed-in user is required." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const liveKitApiKey = Deno.env.get("LIVEKIT_API_KEY");
  const liveKitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  if (!supabaseUrl || !supabaseAnonKey || !liveKitApiKey || !liveKitApiSecret) {
    console.error("LiveKit token service is missing required server configuration.");
    return jsonResponse({ error: "Call service is not configured." }, 500);
  }

  let body: { groupId?: unknown; participantName?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof body.groupId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.groupId)
  ) {
    return jsonResponse({ error: "A valid study group is required." }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return jsonResponse({ error: "Your login session is invalid or expired." }, 401);
  }

  const { data: isMember, error: membershipError } = await supabase.rpc(
    "is_study_group_member",
    { p_group_id: body.groupId },
  );
  if (membershipError) {
    console.error("Unable to verify study group membership:", membershipError);
    return jsonResponse({ error: "Could not verify your study group membership." }, 500);
  }
  if (isMember !== true) {
    return jsonResponse({ error: "Join this study group before starting its call." }, 403);
  }

  const requestedName = typeof body.participantName === "string"
    ? body.participantName.trim()
    : "";
  const participantName = (requestedName || "Student").slice(0, 40);

  try {
    const token = new AccessToken(liveKitApiKey, liveKitApiSecret, {
      identity: crypto.randomUUID(),
      name: participantName,
      ttl: "1h",
    });
    token.addGrant({
      roomJoin: true,
      room: `focus-${body.groupId.toLowerCase()}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return jsonResponse({ token: await token.toJwt() }, 200);
  } catch (error) {
    console.error("Failed to issue LiveKit room token:", error);
    return jsonResponse({ error: "Could not create a call token." }, 500);
  }
});
