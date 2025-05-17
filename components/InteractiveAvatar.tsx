// components/InteractiveAvatar.tsx

import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
  APIError,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import PropertyGrid from "@/app/immobili/PropertyGrid";
import { Property } from "@/app/immobili/types";
import immobiliData from '@/data/immobili.json'; // Assicurati che il percorso sia corretto
import { AVATARS } from "@/app/lib/constants"; //

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATARS[0].avatar_id, // Valore iniziale, può essere cambiato da AvatarConfig
  knowledgeId: undefined,        // L'utente DEVE impostarlo tramite AvatarConfig
  voice: {
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  language: "it",
  disableIdleTimeout: true,
  voiceChatTransport: VoiceChatTransport.LIVEKIT,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();
  const [properties, setProperties] = useState<Property[]>([]);
  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const mediaStream = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Log di base per quando le proprietà cambiano, utile per il debug del rendering
    // console.log("Stato 'properties' aggiornato:", JSON.stringify(properties, null, 2));
  }, [properties]);

  async function fetchAccessToken() {
    setError(null);
    try {
      const response = await fetch("/api/get-access-token", { method: "POST" }); //
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fallimento nel recuperare il token di accesso: ${response.status} ${errorText}`);
      }
      const token = await response.text();
      if (!token) throw new Error("Token di accesso ricevuto è vuoto o non valido.");
      return token;
    } catch (err) {
      console.error("Errore in fetchAccessToken:", err);
      const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto nel recuperare il token.";
      setError(errorMessage);
      throw err;
    }
  }

  const extractPropertyId = (message: string): string | null => {
    const match = message.match(/\[ID:([a-zA-Z0-9]+)\]/);
    return match ? match[1] : null;
  };

  const findPropertyById = (id: string): Property | undefined => {
    if (!immobiliData || !immobiliData.catalogo_immobili || !immobiliData.catalogo_immobili.immobili) {
      console.error("Errore: Struttura di immobiliData (da /data/immobili.json) non valida o file non caricato.");
      return undefined;
    }
    return immobiliData.catalogo_immobili.immobili.find(p => p.id === id); //
  };

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    setError(null);
    setProperties([]);

    if (!config.knowledgeId) { // Controllo che knowledgeId sia stato impostato (non undefined/vuoto)
        const errMsg = "Knowledge ID non è impostato. Configuralo tramite il pannello prima di avviare la sessione.";
        console.error(errMsg);
        setError(errMsg);
        return;
    }
    if (!config.avatarName) { // Controllo che avatarName sia stato impostato
        const errMsg = "Avatar Name (ID) non è impostato. Configuralo tramite il pannello prima di avviare la sessione.";
        console.error(errMsg);
        setError(errMsg);
        return;
    }

    console.log("Avvio sessione con configurazione:", config);

    try {
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      avatar.on(StreamingEvents.ERROR, (errEvent) => {
        console.error("Errore dall'SDK HeyGen:", errEvent);
        const detail = (errEvent as CustomEvent)?.detail;
        let errMsg = "Errore SDK HeyGen.";
        if (detail) {
            if (detail.code) errMsg += ` Codice: ${detail.code}`;
            if (detail.reason) errMsg += ` Motivo: ${detail.reason}`;
            if (detail.message) errMsg += ` Messaggio: ${detail.message}`;
        } else if (typeof errEvent === 'string') {
            errMsg = errEvent;
        }
        setError(errMsg);
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, (e) => {
        console.log("Stream disconnesso.", e);
        setProperties([]);
      });

      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        const messageText = event.detail.message;
        console.log("Messaggio Avatar:", messageText);
        const propertyId = extractPropertyId(messageText);

        if (propertyId) {
          const property = findPropertyById(propertyId);
          if (property) {
            setProperties([property]);
          } else {
            console.warn(`Immobile con ID "${propertyId}" non trovato nel JSON locale.`);
          }
        }
      });

      // Minimal log for other events if needed for basic flow understanding
      // avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => console.log("Avatar ha iniziato a parlare"));
      // avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => console.log("Avatar ha smesso di parlare"));

      await startAvatar(config);

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (err) {
      console.error("Errore durante l'avvio della sessione:", err);
      let errorMessage = "Errore durante l'avvio della sessione dell'avatar.";
      if (typeof APIError !== 'undefined' && err instanceof APIError) {
        errorMessage = `Errore API HeyGen (${err.status}): ${err.message}`;
        if (err.details) errorMessage += ` Dettagli: ${JSON.stringify(err.details)}`;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    }
  });

  useUnmount(() => {
    stopAvatar();
    setProperties([]);
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play().catch(e => {
            console.error("Errore riproduzione stream video:", e);
            setError("Errore durante la riproduzione dello stream video.");
        });
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="flex h-screen">
      <div className="w-1/2 h-full flex flex-col bg-zinc-900">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {error && (
            <div className="absolute top-0 left-0 right-0 p-2 bg-red-700 text-white text-center z-50" style={{fontSize: '0.8rem'}}>
              <p><strong>Errore:</strong> {error}</p>
              <button onClick={() => setError(null)} className="ml-2 p-1 bg-red-900 rounded text-xs">OK</button>
            </div>
          )}
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <AvatarConfig config={config} onConfigChange={setConfig} /> //
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)} disabled={sessionState !== StreamingAvatarSessionState.INACTIVE || !!error}>
                Inizia Chat Vocale
              </Button>
              <Button onClick={() => startSessionV2(false)} disabled={sessionState !== StreamingAvatarSessionState.INACTIVE || !!error}>
                Inizia Chat Testuale
              </Button>
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
        {sessionState === StreamingAvatarSessionState.CONNECTED && (
          <div className="p-4 border-t border-zinc-700">
            <MessageHistory />
          </div>
        )}
      </div>
      <div className="w-1/2 h-full">
        <PropertyGrid properties={properties} />
      </div>
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  const basePath = process.env.NEXT_PUBLIC_BASE_API_URL;
  if (!basePath) {
    console.warn("ATTENZIONE: NEXT_PUBLIC_BASE_API_URL non è definito. Usato fallback.");
  }
  return (
    <StreamingAvatarProvider basePath={basePath || "https://api.heygen.com"}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}