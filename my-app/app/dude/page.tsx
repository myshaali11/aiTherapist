"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

// --- Types
type Sender = "me" | "ai";
type MsgType = "text" | "video";

type Message = {
  id: string;
  from: Sender;
  type: MsgType;
  content: string; // text or video URL
  thumbnail?: string; // data URL for video thumbnail
  ts: number;
  audioBase64?: string;
};

// --- Constants
const STORAGE_KEY = "dude_messages_v1";
const BACKEND_ANALYZE = "/api/analyze"; // update if needed

// --- Helpers
const uid = () => Math.random().toString(36).slice(2, 9);

/* async function blobToDataURL(blob: Blob) {
  return new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result));
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
} */

// Create a thumbnail for a video blob by drawing first frame to canvas.
/* async function createVideoThumbnail(blobUrl: string) {
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement("video");
    video.src = blobUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.remove();
    };

    video.addEventListener("loadeddata", () => {
      try {
        const canvas = document.createElement("canvas");
        const w = (canvas.width = Math.min(320, video.videoWidth || 320));
        const h = (canvas.height = Math.min(180, video.videoHeight || 180));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(undefined);
        ctx.drawImage(video, 0, 0, w, h);
        const data = canvas.toDataURL("image/jpeg", 0.7);
        cleanup();
        resolve(data);
      } catch (e) {
        cleanup();
        resolve(undefined);
        console.error(e)
      }
    });

    // If seeking/timeouts fail, fallback after some time
    setTimeout(() => resolve(undefined), 3000);
  });
} */

// --- Components
function MessageBubble({
  msg,
  onPlay,
}: {
  msg: Message;
  onPlay: (url: string) => void;
}) {
  const isMe = msg.from === "me";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`w-full flex ${isMe ? "justify-end" : "justify-start"} py-2`}
    >
      <div className={`max-w-[78%] ${isMe ? "text-right" : "text-left"}`}>
        {msg.type === "text" ? (
          <div className="flex items-center gap-2">
            <div
              className={`inline-block p-3 rounded-2xl break-words text-sm sm:text-base ${
                isMe
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-white/10 text-white rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>

            {/* AUDIO ICON (AI only, when audio exists) */}
            {msg.from === "ai" && msg.audioBase64 && (
              <button
                onClick={() => {
                  const audio = new Audio(
                    `data:audio/mpeg;base64,${msg.audioBase64}`
                  );
                  audio.play();
                }}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="white"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 8l-4 4 4 4V8zm3-4v16l8-8-8-8z" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="inline-block rounded-2xl overflow-hidden shadow-lg bg-black/30">
            {msg.thumbnail ? (
              <div
                className="relative cursor-pointer"
                onClick={() => onPlay(msg.content)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={msg.thumbnail}
                  alt="video thumb"
                  className="w-48 h-28 object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-2 bg-white/80 rounded-full">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="black"
                    >
                      <path d="M5 3v18l15-9z" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              // fallback small inline video
              <video
                src={msg.content}
                className="w-48 h-28 object-cover bg-black"
                controls={false}
                onClick={() => onPlay(msg.content)}
              />
            )}
          </div>
        )}
        <div className="text-[10px] text-white/50 mt-1">
          {new Date(msg.ts).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}

/* function TypingBubble() {
  // WhatsApp-like three bouncing dots
  const dot = (i: number) => (
    <motion.span
      key={i}
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
      }}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
    />
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="w-full flex justify-start py-2"
    >
      <div className="inline-block p-3 rounded-2xl break-words text-sm sm:text-base bg-white/10 text-white rounded-bl-none">
        <div className="flex items-end gap-1 h-6">
          <div className="w-12 flex items-center justify-between">
            {dot(0)} {dot(1)} {dot(2)}
          </div>
        </div>
      </div>
    </motion.div>
  );
} */

export default function DudeChat() {
  // Messages state (chat history)
  const [messages, setMessages] = useState<Message[]>([]);

  // Input states
  const [textPrompt, setTextPrompt] = useState("");

  // Recording states and refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedURL, setRecordedURL] = useState<string | null>(null); // preview for unsent recording
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  // UI
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null); // modal
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

  // Load messages from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to load messages", e);
    }
  }, []);

  // Persist messages + scroll
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to save messages", e);
    }
    // scroll to bottom
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isAwaitingResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // stop any live tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordedURL) URL.revokeObjectURL(recordedURL);
    };
  }, [recordedURL]);

  useEffect(() => {
    if (isRecording && liveVideoRef.current && mediaStreamRef.current) {
      const videoEl = liveVideoRef.current;
      videoEl.srcObject = mediaStreamRef.current;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.play().catch((err) => console.warn("Video play failed:", err));
    }
  }, [isRecording]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      mediaStreamRef.current = stream;
      setIsRecording(true);

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp8,opus",
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      console.error("getUserMedia failed", err);
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;

    if (!recorder || recorder.state !== "recording") return;

    recorder.onstop = async () => {
      try {
        // Combine recorded chunks into a Blob
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        // Reset chunk buffer
        chunksRef.current = [];

        // Update state for playback preview
        setRecordedBlob(blob);
        setRecordedURL(url);
        setIsRecording(false);

        // Stop all active media tracks (camera + mic)
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        // Safely clear live preview
        if (liveVideoRef.current) {
          try {
            liveVideoRef.current.srcObject = null;
            liveVideoRef.current.pause();
          } catch (err) {
            console.warn("Failed to clear live video stream:", err);
          }
        }

        // Cleanup refs
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      } catch (err) {
        console.error("Error while stopping recording:", err);
        setIsRecording(false);
      }
    };

    // Stop recording — triggers the onstop handler above
    try {
      recorder.stop();
    } catch (err) {
      console.error("Failed to stop recorder:", err);
    }
  }

  function handleDeleteRecording() {
    if (recordedURL) URL.revokeObjectURL(recordedURL);
    setRecordedURL(null);
    setRecordedBlob(null);
    chunksRef.current = [];
  }

  // --- Messaging logic
  function pushMessage(msg: Message) {
    setMessages((s) => [...s, msg]);
  }

  async function handleSend() {
    // guard: don't spam
    if (isAwaitingResponse) return;

    // If there's a recorded video pending, send that, otherwise send text
    if (recordedBlob) {
      const myMsg: Message = {
        id: uid(),
        from: "me",
        type: "video",
        content: recordedURL!, // this is the preview url you created earlier
        ts: Date.now(),
      };
      pushMessage(myMsg);

      const form = new FormData();
      form.append("file", recordedBlob, "recorded_video.webm");

      // quick debug: make sure blob exists
      console.log("Uploading blob:", recordedBlob, "size:", recordedBlob?.size);

      // clear preview UI immediately (user already "sent")
      setRecordedURL(null);
      setRecordedBlob(null);

      setIsAwaitingResponse(true);
      try {
        // IMPORTANT: do NOT set Content-Type manually — let the browser add the boundary
        // const res = await axios.post(BACKEND_ANALYZE, form);
        const res = await fetch("http://localhost:3000/api/analyze", {
          method: "POST",
          body: form,
        });
        const resJson = await res.json();
        console.log("Response from /api/analyze:", resJson);
        const aiText = resJson?.response || "(no response)";
        pushMessage({
          id: uid(),
          from: "ai",
          type: "text",
          content: aiText,
          ts: Date.now(),
          audioBase64: resJson?.audioBase64 || undefined,
        });
      } catch (err: unknown) {
        console.error("Failed to upload recorded video:", err);
        // surface server error message if available
        const errMsg = "Error analyzing recorded video.";
        pushMessage({
          id: uid(),
          from: "ai",
          type: "text",
          content: `Error analyzing recorded video from frontend: ${String(
            errMsg
          )}`,
          ts: Date.now(),
        });
      } finally {
        setIsAwaitingResponse(false);
      }

      return;
    }

    if (textPrompt.trim()) {
      const payloadText = textPrompt.trim();
      const myMsg: Message = {
        id: uid(),
        from: "me",
        type: "text",
        content: payloadText,
        ts: Date.now(),
      };
      pushMessage(myMsg);
      const payload = new FormData();
      payload.append("textPrompt", payloadText);
      setTextPrompt("");

      setIsAwaitingResponse(true);
      try {
        const res = await axios.post(BACKEND_ANALYZE, payload);
        const aiText = res?.data?.response || "(no response)";
        pushMessage({
          id: uid(),
          from: "ai",
          type: "text",
          content: aiText,
          ts: Date.now(),
        });
      } catch (e) {
        console.error("Failed to send text", e);
        pushMessage({
          id: uid(),
          from: "ai",
          type: "text",
          content: "Error contacting server.",
          ts: Date.now(),
        });
      }
      setIsAwaitingResponse(false);
    }
  }

  // play video modal
  function openVideo(url: string) {
    setPlayingVideo(url);
  }

  function closeVideo() {
    setPlayingVideo(null);
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-black to-slate-800 text-white p-3 flex flex-col">
      <header className="flex items-center justify-between py-4 px-2">
        <h1 className="text-2xl font-semibold font-alohaMagazine">
          Hello, User
        </h1>
        <div className="text-sm text-white/60">
          Client-only chat · saved locally
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4" id="chat-window">
        <div className="max-w-3xl mx-auto py-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} onPlay={openVideo} />
          ))}

          {/* Typing indicator shown while awaiting a response */}
          {isAwaitingResponse && (
            <div className="w-full flex justify-start py-2">
              <div className="inline-block bg-white/10 p-3 rounded-2xl">
                <DotLottieReact
                  src="/loader.lottie" // path to your .lottie file in public folder
                  loop
                  autoplay
                  style={{ width: 75, height: 50 }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Recording preview overlay (small) */}
      {(isRecording || recordedURL) && (
        <div className="fixed left-1/2 transform -translate-x-1/2 bottom-28 z-40 w-[90%] max-w-md p-2 rounded-xl bg-black/30 border border-white/10 backdrop-blur">
          {isRecording ? (
            <div>
              <video
                ref={liveVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg object-cover h-48"
              />
              <div className="text-xs text-white/70 mt-1 font-montserrat">
                Recording… click the stop button to finish
              </div>
            </div>
          ) : recordedURL ? (
            <div className="flex gap-3 items-center">
              <video src={recordedURL} controls className="w-full rounded-lg" />
            </div>
          ) : null}
        </div>
      )}

      {/* Bottom bar */}
      <div className="mt-3 p-3 bg-black/30 border-t border-white/10 rounded-t-lg backdrop-blur flex items-center gap-3">
        <motion.input
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Type a message or record a video"
          className="flex-1 bg-transparent outline-none text-white text-lg px-3 py-2 rounded-lg font-montserrat"
          whileFocus={{}}
        />

        {/* Voice stub (keeps original look) */}
        <button
          className="p-3 rounded-md bg-white/6 hover:bg-white/12"
          onClick={() => {
            pushMessage({
              id: uid(),
              from: "me",
              type: "text",
              content: "(voice message)",
              ts: Date.now(),
            });
            setTimeout(
              () =>
                pushMessage({
                  id: uid(),
                  from: "ai",
                  type: "text",
                  content: "(voice reply)",
                  ts: Date.now(),
                }),
              700
            );
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>

        {/* Video record / delete button */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            className={`p-3 rounded-md ${
              isRecording ? "bg-red-600" : "bg-white/6"
            }`}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="white"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="6" width="14" height="12" rx="2" />
                <path d="m16 10 6-4v12l-6-4" />
              </svg>
            )}
          </button>

          {/* Delete recorded preview */}
          {recordedURL && (
            <button
              onClick={handleDeleteRecording}
              className="p-3 rounded-md bg-white/6"
              title="Delete recording"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}

          {/* Send button */}
          <motion.button
            onClick={handleSend}
            className="p-3 rounded-md bg-indigo-600"
            title="Send"
            whileTap={{ scale: 0.95 }}
            animate={
              isAwaitingResponse ? { rotate: [0, 6, -6, 0] } : { rotate: 0 }
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="white"
            >
              <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* video modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={closeVideo}
        >
          <div
            className="w-full max-w-3xl bg-black rounded shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={playingVideo}
              controls
              autoPlay
              className="w-full h-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
