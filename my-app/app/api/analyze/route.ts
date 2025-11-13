import { NextResponse } from "next/server";

// import libraries
import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import FormData from "form-data";


type CustomError = Error & {
  response?: { data?: unknown };
  config?: unknown;
};

const AI_MODEL = process.env.AI_MODEL


// load .env variables
dotenv.config();

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 200 });
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

async function callChatterboxTTS(text: string, audioPromptPath?: string) {
  const form = new FormData();

  form.append("text_input", text);
  form.append("exaggeration_input", "0.5");
  form.append("temperature_input", "0.8");
  form.append("seed_num_input", "0");
  form.append("cfgw_input", "0.5");
  form.append("vad_trim_input", "false");

  // optional voice prompt
  if (audioPromptPath && fs.existsSync(audioPromptPath)) {
    form.append(
      "audio_prompt_path_input",
      fs.createReadStream(audioPromptPath)
    );
  }

  const res = await axios.post(
    "https://api.replicate.com/v1/predictions", // or HF Space URL
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Token ${process.env.RESEMBLE_API_KEY}`,
      },
      responseType: "arraybuffer", // <--- IMPORTANT
    }
  );

  return Buffer.from(res.data); // return raw audio bytes
}



// 1. Point to context.txt in the same folder
const contextFilePath = path.join(process.cwd(), "app", "api", "analyze", "context.json");

export async function GET(): Promise<NextResponse> {

  return withCors(NextResponse.json({
    "message": "Hello from the Backend"
  }))
}

export async function POST(request: Request): Promise<NextResponse> {

  console.log("Backend Reached")

  const audioVideoEndpoint = process.env.AUDIO_VIDEO_ENDPOINT;
  const llmEndpoint = process.env.LLM_ENDPOINT;
  const MAX_CONTEXT_TOKENS = process.env.MAX_CONTEXT_TOKENS ? parseInt(process.env.MAX_CONTEXT_TOKENS) : 2048;
  const systemPrompt = `
    SYSTEM
    You are an empathetic, human-like AI mental-health assistant called "EmpathAIse". Your tone is warm, non-judgmental, concise, and genuine — like a calm, attentive human listener. Always:
      1. Reflect the user's emotion first (one short sentence that names the feeling).
      2. Validate the feeling (one short sentence: "That makes sense" / "I hear you").
      3. Offer one practical, immediate coping step the user can try in the next 5 minutes.
      4. Ask one gentle clarifying question only if it will help provide safer or more useful guidance.
      5. Avoid giving medical diagnoses or prescribing medication. Use conditional language ("you might consider", "it may help to...").
      6. If the user expresses self-harm intent or imminent danger, immediately:
        - Use calm, direct triage language: ask if they are safe right now, advise contacting local emergency services if they have a plan, and give brief steps to stay safe (do not provide specific self-harm instructions).
        - Recommend contacting a crisis hotline and a human professional and escalate (do not attempt to counsel through an emergency).
      7. Provide a short signpost to seek professional help when appropriate (clinician, emergency contact).
      8. End with a short supportive closing sentence and offer to stay with them or continue.
      9. Keep the conversation as ptomistic as possible.

    Keep replies approximately 2-6 sentences (unless the user is in crisis—then be brief, clear, and directive). Always be respectful, patient, and human-like.
    Begin.
  `

  function saveContext(context: number[]): void {
    // Ensure context does not exceed MAX_CONTEXT_TOKENS
    if (context.length > MAX_CONTEXT_TOKENS) {
      context = context.slice(-MAX_CONTEXT_TOKENS); // Keep only recent tokens
    }
    fs.writeFileSync(contextFilePath, JSON.stringify(context, null, 2), "utf-8");
  }

  function loadContext(): number[] {
    if (fs.existsSync(contextFilePath)) {
      const fileContent = fs.readFileSync(contextFilePath, "utf-8").trim();
      return fileContent ? JSON.parse(fileContent) as number[] : [];
    }
    return [];
  }


  let context: number[] = loadContext();

  console.log("Request received")

  // let llmResponse: { data: { response: string; context: number[] } } | null = null;
  try {
    // Parse the incoming form data
    const formData = await request.formData();
    const textPrompt = formData.get("textPrompt") as string;
    const fileField = formData.get("file");

    // If only text is provided
    if (!textPrompt) {
      if (!fileField) {
        return withCors(NextResponse.json(
          { error: "No video file provided." },
          { status: 400 }
        ))
      }
    } else {
      // If textPrompt is provided, append it to the context
      const llmResponse = await axios.post(`${llmEndpoint}`, {
        model: AI_MODEL,
        prompt: `
          ${textPrompt} 
          ${systemPrompt}`,
        max_tokens: 50,
        temperature: 0.8,
        top_p: 0.5,
        stream: false,
        context: context,
      }, {
        headers: { "Content-Type": "application/json" }
      });

      if (llmResponse && llmResponse.data && llmResponse.data.context) {
        context = llmResponse.data.context;
      }

      saveContext(context);

      console.log("context saved")

      console.log("Response from LLM for text prompt sent")
      return withCors(NextResponse.json({
        "response": llmResponse?.data?.response || "No response available"
      }))

    }

    console.log("Accessing file field")
    // 'fileField' is a File object (browser/Web API), so convert it to a buffer.
    const videoFile = fileField as File;
    console.log("File field accessed")
    const arrayBuffer = await videoFile.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    console.log("Sending data to other endpoints")

    // Prepare a FormData for the /analyze-audio endpoint.

    const audioVideoFormData = new FormData();
    audioVideoFormData.append("file", new Blob([videoBuffer], { type: videoFile.type }), videoFile.name);
    const audioVideoResponse = await fetch(`${audioVideoEndpoint}/analyze`, {
      method: "POST",
      body: audioVideoFormData,
    });

    const audioVideoData = await audioVideoResponse.json();

    const processorResponse = {
      message: "Video processed and sent successfully",
      audioVideoResponse: audioVideoData,
    }


    const promptText = `
      The user is in a ${processorResponse.audioVideoResponse?.face_emotion || "neutral"} mood.
      From the voice the emotion is - ${processorResponse.audioVideoResponse?.voice_emotion || "neutral"}

      - Transcript: "${processorResponse.audioVideoResponse?.transcription || "No transcript available"}"

      ${systemPrompt}
      `;

    console.log("Sending data to LLM")
    console.log(promptText)

    // Send the processed data to the LLM endpoint

    const llmResponse = await axios.post(
      `${llmEndpoint}`,
      {
        model: AI_MODEL,
        prompt: promptText,
        max_tokens: 50,
        temperature: 0.8,
        top_p: 0.5,
        stream: false,
        context: context
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    if (llmResponse && llmResponse.data && llmResponse.data.context) {
      context = llmResponse.data.context;
    }

    saveContext(context);

    console.log("context saved")

    console.log("Response sent to client")
    console.log("Response:", llmResponse)

    // 1. Extract text response from LLM
    const reply = llmResponse?.data?.response || "No response available";

    // 2. Convert to TTS
    const audioBuffer = await callChatterboxTTS(reply, "Sample_Voice.mpeg");

    // 3. Convert audio to base64 so frontend can play it easily
    const base64Audio = audioBuffer.toString("base64");

    // 4. Return both text + audio
    return withCors(
      NextResponse.json({
        text: reply,
        audioBase64: base64Audio,
        audioMime: "audio/mpeg"
      })
    );

  } catch (error: unknown) {
    const e = error as CustomError;
    console.error("Error processing video:", {
      message: e.message,
      stack: e.stack,
      response: e.response?.data,
      config: e.config,
    });

    return withCors(NextResponse.json(
      { error: "Internal Server Error", details: e.message },
      { status: 500 }
    ))
  }

}
