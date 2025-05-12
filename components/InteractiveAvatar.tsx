// components/InteractiveAvatar.tsx

import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic"; // Corretto
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import PropertyGrid from "@/app/immobili/PropertyGrid";
import { Property } from "@/app/immobili/types"; // Assicurati che Property sia importato
import immobiliData from '@/data/immobili.json'; // Importa i dati degli immobili
import { AVATARS } from "@/app/lib/constants";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATARS[0].avatar_id,
  knowledgeId: undefined, // Questo sarà l'ID della tua Knowledge Base configurata su HeyGen
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
  const [properties, setProperties] = useState<Property[]>([]); // Stato per le card degli immobili
  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const mediaStream = useRef<HTMLVideoElement>(null);

  // Funzione per ottenere il token di accesso dall'API backend
  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", { // Percorso del tuo endpoint API
        method: "POST",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to retrieve access token: ${response.status} ${errorText}`);
      }
      const token = await response.text();
      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  // Funzione per estrarre l'ID dell'immobile dal messaggio dell'avatar
  const extractPropertyId = (message: string): string | null => {
    const match = message.match(/\[ID:(\d+)\]/);
    // console.log("Attempting to extract ID from:", message, "Match:", match); // Per debug
    return match ? match[1] : null;
  };

  // Funzione per trovare l'immobile per ID nel file JSON importato
  const findPropertyById = (id: string): Property | undefined => {
    // console.log("Searching for ID:", id, "in", immobiliData.catalogo_immobili.immobili); // Per debug
    return immobiliData.catalogo_immobili.immobili.find(p => p.id === id);
  };

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      const newToken = await fetchAccessToken();
      if (!newToken) {
        console.error("Access token is null or undefined. Cannot start session.");
        return;
      }
      const avatar = initAvatar(newToken);

      // Gestione eventi standard dell'avatar
      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
        setProperties([]); // Pulisci le proprietà alla disconnessione
      });
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        console.log("Stream ready:", event.detail);
      });

      // Evento per i messaggi parlati dall'avatar (per estrarre ID immobile)
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        const messageText = event.detail.message; // Testo parlato dall'avatar
        console.log("Avatar talking message content:", messageText);

        const propertyId = extractPropertyId(messageText);
        if (propertyId) {
          console.log("Extracted Property ID:", propertyId);
          const property = findPropertyById(propertyId);
          if (property) {
            console.log("Property found:", property);
            setProperties([property]); // Mostra la card dell'immobile
          } else {
            console.warn("Property with ID not found in immobiliData:", propertyId);
            // Considera se pulire le card o lasciarle invariate
            // setProperties([]);
          }
        } else {
          // L'avatar ha parlato ma non ha menzionato un ID nel formato atteso.
          // Non fare nulla con setProperties qui per non interrompere la visualizzazione
          // se è una parte generica della conversazione.
          // console.log("No property ID found in current message segment.");
        }
      });

      // Altri eventi standard (puoi loggarli per debug se necessario)
      avatar.on(StreamingEvents.USER_START, (event) => console.log("User started talking:", event));
      avatar.on(StreamingEvents.USER_STOP, (event) => console.log("User stopped talking:", event));
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => console.log("User end message:", event));
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => console.log("User talking message:", event));

      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log("Avatar end message:", event);
        // Potresti voler fare qualcosa alla fine di un messaggio completo dell'avatar,
        // ma resettare le proprietà qui potrebbe essere prematuro se la conversazione continua.
        // La logica per `end_conversation` che avevi prima potrebbe essere più specifica
        // se HeyGen invia un tipo di evento particolare per la fine *dell'intera interazione*.
        // Per ora, mi concentro sull'estrazione dell'ID dal testo corrente.
      });

      await startAvatar(config);

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
      // Potresti voler mostrare un messaggio di errore all'utente qui
    }
  });

  useUnmount(() => {
    stopAvatar();
    setProperties([]); // Pulisci le proprietà quando il componente viene smontato
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play().catch(error => console.error("Error playing video stream:", error));
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="flex h-screen">
      {/* Sezione Avatar - Lato sinistro */}
      <div className="w-1/2 h-full flex flex-col bg-zinc-900">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <AvatarConfig config={config} onConfigChange={setConfig} />
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)} disabled={sessionState !== StreamingAvatarSessionState.INACTIVE}>
                Inizia Chat Vocale
              </Button>
              <Button onClick={() => startSessionV2(false)} disabled={sessionState !== StreamingAvatarSessionState.INACTIVE}>
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

      {/* Sezione Immobili - Lato destro */}
      <div className="w-1/2 h-full">
        <PropertyGrid properties={properties} />
      </div>
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  // Assicurati che NEXT_PUBLIC_BASE_API_URL sia definito nel tuo file .env.local
  // e che il server Next.js sia stato riavviato dopo averlo aggiunto/modificato.
  // Esempio: NEXT_PUBLIC_BASE_API_URL=https://api.heygen.com
  const basePath = process.env.NEXT_PUBLIC_BASE_API_URL;
  if (!basePath) {
    console.warn("NEXT_PUBLIC_BASE_API_URL is not defined. StreamingAvatarProvider might not work correctly.");
    // Potresti voler fornire un fallback o gestire l'errore in modo più esplicito
  }

  return (
    <StreamingAvatarProvider basePath={basePath}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}