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
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !openAiApiKey) {
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

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are FocusTogether's helpful AI study assistant. Explain academic topics clearly, support learning with examples and questions, and keep answers focused. Do not claim to have access to materials the student has not provided.",
          },
          { role: "user", content: body.question.trim() },
        ],
        max_tokens: 800,
      }),
    });
  } catch (error) {
    console.error("OpenAI request failed:", error);
    return jsonResponse({ error: "Could not reach the AI service. Please try again." }, 502);
  }

  if (!openAiResponse.ok) {
    console.error(`OpenAI returned status ${openAiResponse.status}.`);
    return jsonResponse({ error: "The AI service could not answer right now. Please try again." }, 502);
  }

  let completion: unknown;
  try {
    completion = await openAiResponse.json();
  } catch (error) {
    console.error("OpenAI returned an invalid response:", error);
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  if (!isRecord(completion) || !Array.isArray(completion.choices)) {
    console.error("OpenAI response did not contain an assistant message.");
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  const choice = completion.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    console.error("OpenAI response did not contain an assistant message.");
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  const answer = choice.message.content;
  if (typeof answer !== "string" || !answer.trim()) {
    console.error("OpenAI response did not contain an assistant message.");
    return jsonResponse({ error: "The AI service returned an invalid response." }, 502);
  }

  return jsonResponse({ answer: answer.trim() }, 200);
});
