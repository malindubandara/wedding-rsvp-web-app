"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { wedding } from "@/lib/wedding-config";

export type WeddingMusicHandle = { play: () => void };

export default function WeddingMusic({
  ref,
  visible,
}: {
  ref: Ref<WeddingMusicHandle>;
  visible: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = wedding.music.volume;
    // Called directly from the opening click so playback has a user gesture.
    // A blocked/interrupted request leaves the button available to try again.
    void audio.play().catch(() => setPlaying(false));
  };

  useImperativeHandle(ref, () => ({ play }));

  return (
    <>
      <audio
        ref={audioRef}
        src={wedding.music.src}
        loop
        preload="none"
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      />
      {visible && (
        <button
          type="button"
          className={`music-toggle${playing ? " is-playing" : ""}`}
          aria-label={playing ? "Pause wedding music" : "Play wedding music"}
          aria-pressed={playing}
          title={playing ? "Pause wedding music" : "Play wedding music"}
          onClick={() => {
            if (audioRef.current?.paused) play();
            else audioRef.current?.pause();
          }}
        >
          {playing ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          <span className="music-toggle-label">{playing ? "Music on" : "Music off"}</span>
        </button>
      )}
    </>
  );
}
