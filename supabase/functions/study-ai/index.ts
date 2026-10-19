import { createClient } from "npm:@supabase/supabase-js@2";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
    console.error("AI chat service is missing required server configuration.");
    return jsonResponse({ error: "AI chat service is not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return jsonResponse({ error: "Your login session is invalid or expired." }, 401);
  }

  const rawBody = await request.text();
  if (rawBody.length > 24000) {
    return jsonResponse({ error: "Chat request is too large." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (!isRecord(body) || typeof body.question !== "string" || !body.question.trim()) {
    return jsonResponse({ error: "Provide a question to answer." }, 400);
  }
  if (body.question.length > 4000) {
    return jsonResponse({ error: "Question must be under 4,000 characters." }, 413);
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          system_instruction: "You are FocusTogether's helpful AI study assistant. Explain academic topics clearly, support learning with examples and questions, and keep answers focused. Do not claim to have access to materials the student has not provided.",
          input: body.question.trim(),
          store: false,
          generation_config: {
            max_output_tokens: 800,
            thinking_level: "low",
          },
        }),
      },
    );
  } catch (error) {
    console.error("Gemini request failed:", error);
    return jsonResponse({ error: "Could not reach the AI service. Please try again." }, 502);
  }

  if (!geminiResponse.ok) {
    let providerError = "";
    try {
      const errorBody: unknown = await geminiResponse.json();
      if (isRecord(errorBody) && isRecord(errorBody.error) && typeof errorBody.error.message === "string") {
        providerError = ` ${errorBody.error.message.slice(0, 500)}`;
      }
    } catch (error) {
      console.error("Could not read Gemini error response:", error);
    }
    console.error(`Gemini returned status ${geminiResponse.status}.${providerError}`);
    return jsonResponse({ error: "The AI service could not answer right now. Please try again." }, 502);
  }

  let completion: unknown;
  try {
    completion = await geminiResponse.json();
  } catch (error) {
    console.error("Gemini returned an invalid response:", error);
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  if (!isRecord(completion) || !Array.isArray(completion.steps)) {
    console.error("Gemini response did not contain an assistant message.");
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  const answer = completion.steps
    .filter((step) => isRecord(step) && step.type === "model_output" && Array.isArray(step.content))
    .flatMap((step) => isRecord(step) && Array.isArray(step.content) ? step.content : [])
    .map((part) => isRecord(part) && part.type === "text" && typeof part.text === "string" ? part.text : "")
    .join("");
  if (!answer.trim()) {
    console.error("Gemini response did not contain an assistant message.");
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  return jsonResponse({ answer: answer.trim() }, 200);
});
