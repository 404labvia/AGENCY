// components/InteractiveAvatar.tsx

import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
  APIError, // Importa APIError per un type checking più specifico
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
import immobiliData from '@/data/immobili.json'; // Assicurati che questo percorso sia corretto
import { AVATARS } from "@/app/lib/constants";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATARS[0].avatar_id, // Assicurati che questo sia un ID avatar valido per il tuo account
  knowledgeId: "d7e6040fd8b54d319ecd7c9d98f4a90f", // <--- IMPOSTA QUESTO ID VALIDO!
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

  // Hook per loggare cambiamenti nello stato 'properties'
  useEffect(() => {
    console.log("DEBUG: Stato 'properties' aggiornato:", JSON.stringify(properties, null, 2));
  }, [properties]);

  // Hook per avvisare se knowledgeId non è valido all'inizio (se si usa AvatarConfig)
   useEffect(() => {
    if (config.knowledgeId === "IL_TUO_ID_KNOWLEDGE_BASE_VALIDO_DA_HEYGEN" && sessionState === StreamingAvatarSessionState.INACTIVE) {
        console.warn("ATTENZIONE: 'knowledgeId' in DEFAULT_CONFIG è un placeholder. Assicurati di impostare un ID valido tramite AvatarConfig o direttamente nel codice.");
        // Considera di impostare un errore se l'utente prova ad avviare la sessione senza cambiarlo
    }
  }, [config.knowledgeId, sessionState]);


  async function fetchAccessToken() {
    setError(null);
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fallimento nel recuperare il token di accesso: ${response.status} ${errorText}`);
      }
      const token = await response.text();
      if (!token) {
        throw new Error("Token di accesso ricevuto è vuoto o non valido.");
      }
      console.log("Token di accesso recuperato."); // Evita di loggare il token stesso per sicurezza
      return token;
    } catch (err) {
      console.error("Errore in fetchAccessToken:", err);
      const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto nel recuperare il token.";
      setError(errorMessage);
      throw err;
    }
  }

  const extractPropertyId = (message: string): string | null => {
    // Cerca "[ID:" seguito da uno o più caratteri alfanumerici (lettere, numeri) e lo cattura, fino alla "]"
    const match = message.match(/\[ID:([a-zA-Z0-9]+)\]/);
    console.log("DEBUG: Messaggio ricevuto dall'avatar:", message);
    console.log("DEBUG: Tentativo di estrazione ID con regex. Match:", match);
    return match ? match[1] : null;
  };

  const findPropertyById = (id: string): Property | undefined => {
    console.log(`DEBUG: Ricerca immobile con ID "${id}" nel JSON locale.`);
    if (!immobiliData || !immobiliData.catalogo_immobili || !immobiliData.catalogo_immobili.immobili) {
        console.error("ERRORE CRITICO: Struttura di immobiliData (da /data/immobili.json) non valida o file non caricato correttamente.");
        setError("Errore interno: impossibile caricare i dati degli immobili. Controllare i log.");
        return undefined;
    }
    const foundProperty = immobiliData.catalogo_immobili.immobili.find(p => p.id === id);
    if (foundProperty) {
        console.log("DEBUG: Immobile trovato nel JSON locale:", JSON.stringify(foundProperty, null, 2));
    } else {
        console.warn(`ATTENZIONE: Immobile con ID "${id}" non trovato nel JSON locale (/data/immobili.json). Verifica la sincronizzazione con i dati usati da HeyGen (Gist).`);
    }
    return foundProperty;
  };

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    setError(null);
    setProperties([]);

    if (!config.knowledgeId || config.knowledgeId === "IL_TUO_ID_KNOWLEDGE_BASE_VALIDO_DA_HEYGEN") {
        const errMsg = "Knowledge ID non è impostato o è un placeholder. Configuralo prima di avviare la sessione.";
        console.error(errMsg);
        setError(errMsg);
        return;
    }
    if (!config.avatarName) {
        const errMsg = "Avatar Name (ID) non è impostato. Configuralo prima di avviare la sessione.";
        console.error(errMsg);
        setError(errMsg);
        return;
    }

    console.log("Tentativo di avvio sessione con la configurazione:", JSON.stringify(config, null, 2));

    try {
      const newToken = await fetchAccessToken();
      console.log("Inizializzazione avatar...");
      const avatar = initAvatar(newToken);

      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => console.log("Evento: Avatar started talking", e));
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => console.log("Evento: Avatar stopped talking", e));
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, (e) => {
        console.log("Evento: Stream disconnected", e);
        setProperties([]);
      });
      avatar.on(StreamingEvents.STREAM_READY, (event) => console.log("Evento: Stream ready:", event.detail));
      avatar.on(StreamingEvents.ERROR, (errEvent) => {
        console.error("ERRORE dall'SDK HeyGen:", errEvent);
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

      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log("--- Inizio Elaborazione AVATAR_TALKING_MESSAGE ---");
        const messageText = event.detail.message;
        const propertyId = extractPropertyId(messageText);

        if (propertyId) {
          console.log(`DEBUG: ID estraibile trovato: "${propertyId}"`);
          const property = findPropertyById(propertyId);
          if (property) {
            console.log("DEBUG: Immobile corrispondente trovato. Chiamata a setProperties...");
            setProperties([property]);
            console.log("DEBUG: Chiamata a setProperties effettuata.");
          } else {
            // L'ID è stato estratto, ma non trovato nel JSON locale.
            // Non reimpostare properties qui, potrebbe essere un falso negativo o l'ID è in un Gist non sincronizzato.
            // Il warning in findPropertyById è sufficiente.
          }
        } else {
          console.log("DEBUG: Nessun ID immobile nel formato [ID:...] trovato in questo frammento di messaggio.");
        }
        console.log("--- Fine Elaborazione AVATAR_TALKING_MESSAGE ---");
      });

      avatar.on(StreamingEvents.USER_START, (event) => console.log("Evento: User started talking:", event));
      avatar.on(StreamingEvents.USER_STOP, (event) => console.log("Evento: User stopped talking:", event));
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => console.log("Evento: User end message:", event));
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => console.log("Evento: User talking message:", event));
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log("Evento: Avatar end message (fine del blocco di parlato):", event);
        // Considera se resettare properties qui. Se un messaggio di fine indica
        // la fine di un suggerimento e non ne sono seguiti altri, potrebbe aver senso.
        // Ma se la conversazione continua, potrebbe essere meglio non farlo.
        // Se l'avatar dice "[ID:123] Ecco la villa. Vuole sapere altro?" e questo è l'end_message,
        // non vuoi pulire la card.
        // Questa logica dipende molto dal comportamento della tua Knowledge Base.
      });

      console.log("Avvio avatar con startAvatar...");
      await startAvatar(config);
      console.log("Chiamata startAvatar completata.");

      if (isVoiceChat) {
        console.log("Avvio chat vocale...");
        await startVoiceChat();
        console.log("Chat vocale avviata.");
      }
    } catch (err) {
      console.error("Errore critico durante startSessionV2:", err);
      let errorMessage = "Errore durante l'avvio della sessione dell'avatar.";
      if (err instanceof APIError) {
        errorMessage = `Errore API HeyGen (${err.status}): ${err.message}`;
        if (err.details) {
            errorMessage += ` Dettagli: ${JSON.stringify(err.details)}`;
        }
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
            <AvatarConfig config={config} onConfigChange={setConfig} />
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
    console.warn("ATTENZIONE: NEXT_PUBLIC_BASE_API_URL non è definito nel tuo file .env.local. Controlla la configurazione. Verrà usato un fallback o potrebbe fallire.");
  }
  return (
    <StreamingAvatarProvider basePath={basePath || "https://api.heygen.com"}> {/* Aggiunto fallback per basePath */}
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}