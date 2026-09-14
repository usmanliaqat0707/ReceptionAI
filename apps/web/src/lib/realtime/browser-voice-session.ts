import { RealtimeAgent, RealtimeSession, RealtimeItem } from "@openai/agents/realtime";

export type SessionConnectionState =
  "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ENDING" | "ENDED" | "ERROR";

export type AgentSpeechState = "idle" | "listening" | "thinking" | "speaking" | "interrupted";

export interface NormalizedTranscriptItem {
  id: string;
  role: "USER" | "ASSISTANT";
  text: string;
  timestamp: string;
  isFinal: boolean;
}

export interface NormalizedRealtimeEvent {
  id: string;
  timestamp: string;
  type:
    | "session_connecting"
    | "session_connected"
    | "speech_started"
    | "speech_stopped"
    | "audio_interrupted"
    | "greeting_spoken"
    | "mic_muted"
    | "mic_unmuted"
    | "session_ended"
    | "error";
  summary: string;
  details?: Record<string, any>;
}

import { createBrowserRealtimeTools, ToolExecutionEvent } from "./client-tools";

export interface VoiceSessionConfig {
  testSessionId: string;
  clientSecret: string;
  model: string;
  voice: string;
  instructions: string;
  initialGreeting: string;
  receptionistName: string;
  receptionistRole: string;
  allowedTools?: Array<{ name: string; description: string }>;
}

export interface VoiceSessionCallbacks {
  onStateChange: (state: SessionConnectionState) => void;
  onSpeechStateChange: (state: AgentSpeechState) => void;
  onTranscriptUpdate: (items: NormalizedTranscriptItem[]) => void;
  onEvent: (event: NormalizedRealtimeEvent) => void;
  onAudioLevel?: (level: number) => void; // 0.0 to 1.0
  onToolExecution?: (event: ToolExecutionEvent) => void;
  onError: (error: Error) => void;
}

export class BrowserVoiceSessionController {
  private config: VoiceSessionConfig;
  private callbacks: VoiceSessionCallbacks;
  private session: RealtimeSession | null = null;
  private agent: RealtimeAgent | null = null;
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private meterInterval: any = null;
  private transcriptItems: Map<string, NormalizedTranscriptItem> = new Map();
  private isMuted: boolean = false;
  private state: SessionConnectionState = "DISCONNECTED";

  constructor(config: VoiceSessionConfig, callbacks: VoiceSessionCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  public getState(): SessionConnectionState {
    return this.state;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getTranscriptItems(): NormalizedTranscriptItem[] {
    return Array.from(this.transcriptItems.values());
  }

  private setState(state: SessionConnectionState) {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  private emitEvent(
    type: NormalizedRealtimeEvent["type"],
    summary: string,
    details?: Record<string, any>
  ) {
    const event: NormalizedRealtimeEvent = {
      id: "evt_" + Math.random().toString(36).substring(2, 10),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      type,
      summary,
      details,
    };
    this.callbacks.onEvent(event);
  }

  /**
   * Initializes microphone access, attaches level analyser, creates RealtimeSession,
   * connects via WebRTC using ephemeral clientSecret, and triggers initial greeting.
   */
  public async connect(): Promise<void> {
    if (this.state !== "DISCONNECTED" && this.state !== "ENDED" && this.state !== "ERROR") {
      return;
    }

    this.setState("CONNECTING");
    this.emitEvent(
      "session_connecting",
      "Requesting microphone permission & initiating WebRTC connection"
    );

    try {
      // 1. Microphone access & audio analyser for live visual level indicator
      if (typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.micStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.meterInterval = setInterval(() => {
              if (this.analyser && this.callbacks.onAudioLevel && !this.isMuted) {
                this.analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                const normalized = Math.min(1, average / 128);
                this.callbacks.onAudioLevel(normalized);
              } else if (this.isMuted && this.callbacks.onAudioLevel) {
                this.callbacks.onAudioLevel(0);
              }
            }, 80);
          }
        } catch (micErr: any) {
          console.warn("Microphone meter initialization warning:", micErr);
          // Still proceed to connect via WebRTC transport
        }
      }

      // 2. Instantiate trusted server-backed business tools
      const clientTools = createBrowserRealtimeTools({
        sessionId: this.config.testSessionId,
        allowedToolNames: this.config.allowedTools?.map((t) => t.name),
        onExecutionUpdate: (event) => {
          this.callbacks.onToolExecution?.(event);
        },
      });

      // 3. Instantiate RealtimeAgent from @openai/agents/realtime
      this.agent = new RealtimeAgent({
        name: this.config.receptionistName,
        instructions: this.config.instructions,
        voice: this.config.voice,
        tools: clientTools,
      });

      // 3. Instantiate RealtimeSession with WebRTC transport
      this.session = new RealtimeSession(this.agent, {
        transport: "webrtc",
        model: this.config.model,
      });

      // 4. Attach session event listeners
      this.session.on("audio_start", () => {
        this.callbacks.onSpeechStateChange("speaking");
        this.emitEvent("speech_started", `${this.config.receptionistName} began speaking`);
      });

      this.session.on("audio_stopped", () => {
        this.callbacks.onSpeechStateChange("listening");
        this.emitEvent("speech_stopped", `${this.config.receptionistName} finished speaking`);
      });

      this.session.on("audio_interrupted", () => {
        this.callbacks.onSpeechStateChange("interrupted");
        this.emitEvent(
          "audio_interrupted",
          `Caller barged in; ${this.config.receptionistName} paused speaking`
        );
      });

      this.session.on("history_updated", (history: RealtimeItem[]) => {
        this.processHistory(history);
      });

      this.session.on("error", (errEvent) => {
        console.error("RealtimeSession error:", errEvent);
        this.emitEvent("error", "Realtime session reported an error", { err: String(errEvent) });
        this.callbacks.onError(new Error(String(errEvent.error || "RealtimeSession error")));
      });

      // 5. Connect using ephemeral clientSecret (ek_...)
      await this.session.connect({
        apiKey: this.config.clientSecret,
      });

      this.setState("CONNECTED");
      this.callbacks.onSpeechStateChange("speaking");
      this.emitEvent(
        "session_connected",
        `Connected to OpenAI Realtime (${this.config.model}) via WebRTC`
      );

      // 6. Trigger initial greeting
      this.session.sendMessage({
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `[CALL_CONNECTED: Introduce yourself immediately using your configured greeting: "${this.config.initialGreeting}"]`,
          },
        ],
      });
      this.emitEvent("greeting_spoken", `Prompted greeting: "${this.config.initialGreeting}"`);
    } catch (err: any) {
      console.error("Error connecting Realtime voice session:", err);
      this.setState("ERROR");
      this.emitEvent("error", "Failed to establish WebRTC connection", { error: err.message });
      this.callbacks.onError(err);
      this.cleanupMedia();
      throw err;
    }
  }

  /**
   * Transforms raw RealtimeItems into display-ready caller and receptionist transcripts.
   */
  private processHistory(history: RealtimeItem[]) {
    let hasChanges = false;

    for (const item of history) {
      if (item.type !== "message" || item.role === "system") continue;

      const role = item.role === "assistant" ? "ASSISTANT" : "USER";
      let text = "";

      if (item.content && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "input_text" || part.type === "output_text") {
            if ((part as any).text) text += (part as any).text + " ";
          } else if (part.type === "input_audio" || part.type === "output_audio") {
            if ((part as any).transcript) text += (part as any).transcript + " ";
          }
        }
      }

      text = text.trim();

      // Filter out hidden synthetic setup triggers from display
      if (text.startsWith("[CALL_CONNECTED:")) {
        continue;
      }

      if (text.length === 0 && item.status === "in_progress") {
        text = "...";
      }

      if (text.length > 0) {
        const existing = this.transcriptItems.get(item.itemId);
        if (
          !existing ||
          existing.text !== text ||
          existing.isFinal !== (item.status === "completed")
        ) {
          this.transcriptItems.set(item.itemId, {
            id: item.itemId,
            role,
            text,
            timestamp:
              existing?.timestamp ||
              new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isFinal: item.status === "completed",
          });
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      this.callbacks.onTranscriptUpdate(Array.from(this.transcriptItems.values()));
    }
  }

  /**
   * Mutes or unmutes the microphone capture.
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.session) {
      try {
        this.session.mute(this.isMuted);
      } catch (err) {
        console.warn("Session mute toggle error:", err);
      }
    }

    // Also disable audio tracks directly for hardware reassurance
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }

    if (this.isMuted) {
      this.emitEvent("mic_muted", "Microphone muted by user");
    } else {
      this.emitEvent("mic_unmuted", "Microphone unmuted by user");
    }

    return this.isMuted;
  }

  /**
   * Interrupts assistant speaking manually.
   */
  public interrupt(): void {
    if (this.session) {
      try {
        this.session.interrupt();
        this.callbacks.onSpeechStateChange("listening");
        this.emitEvent("audio_interrupted", "Assistant interrupted via UI button");
      } catch (err) {
        console.warn("Session interrupt error:", err);
      }
    }
  }

  /**
   * Closes the WebRTC session and releases all media devices.
   */
  public disconnect(): void {
    if (this.state === "DISCONNECTED" || this.state === "ENDED") return;

    this.setState("ENDING");
    this.emitEvent("session_ended", "Closing Realtime WebRTC connection");

    try {
      if (this.session) {
        this.session.close();
        this.session = null;
      }
    } catch (err) {
      console.warn("Error closing RealtimeSession:", err);
    }

    this.cleanupMedia();
    this.setState("ENDED");
    this.callbacks.onSpeechStateChange("idle");
  }

  private cleanupMedia() {
    if (this.meterInterval) {
      clearInterval(this.meterInterval);
      this.meterInterval = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.callbacks.onAudioLevel) {
      this.callbacks.onAudioLevel(0);
    }
  }
}
