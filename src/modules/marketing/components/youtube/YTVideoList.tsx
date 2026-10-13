import { formatCompact as fmtK } from "../../lib/dataQuality";
import { Eye, ThumbsUp, MessageCircle, Clock, ExternalLink, PlayCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { YTVideo } from "../../hooks/useMarketingData";


function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yy", { locale: ptBR }); }
  catch { return ""; }
}

interface Props {
  videos: YTVideo[];
  isLoading: boolean;
}

export function YTVideoList({ videos, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum vídeo encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {videos.map((video) => {
        const videoUrl = `https://youtube.com/watch?v=${video.id}`;

        return (
          <a
            key={video.id}
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 p-3 bg-card border rounded-xl hover:border-red-200 dark:hover:border-red-900 transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative w-20 aspect-video rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <PlayCircle size={20} className="text-muted-foreground opacity-30" />
              )}
              {/* Duration */}
              {video.durationSeconds > 0 && (
                <span className="absolute bottom-1 right-1 text-[9px] font-bold text-white bg-black/80 px-1 py-0.5 rounded">
                  {fmtDuration(video.durationSeconds)}
                </span>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                <ExternalLink size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium line-clamp-2 leading-snug">{video.title}</p>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Eye size={9} className="text-blue-400" />
                  {fmtK(video.viewCount)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <ThumbsUp size={9} className="text-emerald-400" />
                  {fmtK(video.likeCount)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MessageCircle size={9} />
                  {fmtK(video.commentCount)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
                  <Clock size={9} />
                  {fmtDate(video.publishedAt)}
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
