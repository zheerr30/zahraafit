"use client";

import { useState } from "react";
import { youtubeId } from "@/lib/exercises";
import { cn } from "@/components/ui/cn";

/** Still picture of a YouTube video (served by YouTube). */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** A still that cannot be loaded (offline, blocked) leaves the dark tile with the play mark, not a broken image. */
const hide = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = "none";
};

function PlayBadge({ size = 44 }: { size?: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="grid place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/40" style={{ width: size, height: size }}>
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    </span>
  );
}

/** The small picture of a card: the video's still with a play mark. */
export function VideoThumb({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const id = youtubeId(url);
  return (
    <span role="img" aria-label={alt} className={cn("relative block overflow-hidden rounded-lg bg-[#131416]", className)}>
      {id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={youtubeThumb(id)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={hide} className="absolute inset-0 size-full object-cover" />
      )}
      <PlayBadge size={30} />
    </span>
  );
}

/**
 * The exercise video. A YouTube link plays in place: the player is loaded only
 * when the play button is pressed (until then, just the still picture), and a
 * plain link stays for videos whose owner does not allow playing them elsewhere.
 * Any other URL is treated as a video file.
 */
export function ExerciseVideo({ url, title, linkClass }: { url: string; title: string; linkClass?: string }) {
  const id = youtubeId(url);
  const [playing, setPlaying] = useState(false);
  if (!id) return <video src={url} controls playsInline preload="none" className="w-full rounded-lg bg-black" aria-label={`فيديو ${title}`} />;
  return (
    <div data-video={id}>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
            title={`فيديو ${title}`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button type="button" data-action="play-video" onClick={() => setPlaying(true)} aria-label={`تشغيل فيديو ${title}`} className="absolute inset-0 size-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={youtubeThumb(id)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={hide} className="absolute inset-0 size-full object-cover" />
            <PlayBadge size={52} />
          </button>
        )}
      </div>
      <a href={`https://youtu.be/${id}`} target="_blank" rel="noopener noreferrer" className={cn("mt-1 inline-block text-[11px]", linkClass)}>
        فتح الفيديو في يوتيوب ↗
      </a>
    </div>
  );
}
