import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
  StreamingAvatarProvider
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import immobiliData from '@/data/immobili.json';
import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import PropertyGrid from "@/app/immobili/PropertyGrid";
import { Property } from "@/app/immobili/types";

import { AVATARS } from "@/app/lib/constants";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATARS[0].avatar_id,
  knowledgeId: undefined, // Sarà impostato dall'interfaccia utente
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
  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const [properties, setProperties] = useState<Property[]>([]);
  const mediaStream = useRef<HTMLVideoElement>(null);

  // Funzione per estrarre l'ID dal messaggio
  const extractPropertyId = (message: string): string | null => {
    const match = message.match(/\[ID:(\d+)\]/);
    return match ? match[1] : null;
  };

  // Funzione per trovare l'immobile per ID
  const findPropertyById = (id: string) => {
    return immobiliData.catalogo_immobili.immobili.find(p => p.id === id);
  };

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      // Gestione messaggi dell'avatar
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        const message = event.detail.message;
        console.log("Avatar message:", message);

        const propertyId = extractPropertyId(message);
        if (propertyId) {
          console.log("Found property ID:", propertyId);
          const property = findPropertyById(propertyId);

          if (property) {
            console.log("Found property:", property);
            setProperties([property]);
          }
        }
      });

      // Altri event listeners
      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
        setProperties([]); // Reset properties on disconnect
      });

      await startAvatar(config);

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
    }
  });

  useUnmount(() => {
    stopAvatar();
    setProperties([]); // Reset properties on unmount
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="flex h-screen">
      {/* Sezione Avatar - Lato sinistro */}
      <div className="w-1/2 h-full flex flex-col bg-zinc-900">
        <div className="relative w-full aspect-video overflow-hidden">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <AvatarConfig config={config} onConfigChange={setConfig} />
          )}
        </div>
        <div className="flex flex-col gap-3 p-4 border-t border-zinc-700">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex gap-4">
              <Button onClick={() => startSessionV2(true)}>
                Inizia Chat Vocale
              </Button>
              <Button onClick={() => startSessionV2(false)}>
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
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}