import { formatCompact as fmtK } from "../../lib/dataQuality";
import { Heart, MessageCircle, Bookmark, Share2, ExternalLink, Film, Images, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { IGMedia } from "../../hooks/useMarketingData";


function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yy", { locale: ptBR }); }
  catch { return ""; }
}

const MEDIA_TYPE_CONFIG: Record<IGMedia["mediaType"], { label: string; icon: React.ElementType; color: string }> = {
  REEL:           { label: "Reel",      icon: Film,     color: "bg-purple-500" },
  VIDEO:          { label: "Vídeo",     icon: Film,     color: "bg-blue-500"   },
  CAROUSEL_ALBUM: { label: "Carrossel", icon: Images,   color: "bg-orange-500" },
  IMAGE:          { label: "Foto",      icon: ImageIcon, color: "bg-pink-500"  },
};

interface Props {
  media: IGMedia[];
  isLoading: boolean;
}

export function IGMediaGrid({ media, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum post encontrado.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {media.map((post) => {
        const typeConfig = MEDIA_TYPE_CONFIG[post.mediaType] ?? MEDIA_TYPE_CONFIG.IMAGE;
        const TypeIcon = typeConfig.icon;

        return (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border rounded-xl overflow-hidden bg-card hover:border-primary/40 transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
              {post.mediaUrl && post.mediaType === "IMAGE" ? (
                <img
                  src={post.mediaUrl}
                  alt={post.caption?.slice(0, 40)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : post.thumbnailUrl ? (
                <img
                  src={post.thumbnailUrl}
                  alt={post.caption?.slice(0, 40)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground opacity-30">
                  <TypeIcon size={32} />
                </div>
              )}

              {/* Type badge */}
              <span className={cn(
                "absolute top-2 left-2 flex items-center gap-1 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full",
                typeConfig.color
              )}>
                <TypeIcon size={9} />
                {typeConfig.label}
              </span>

              {/* External link on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <ExternalLink size={10} className="text-white" />
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-2.5 space-y-1.5">
              {post.caption && (
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {post.caption}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Heart size={10} className="text-red-400" />
                    {fmtK(post.likeCount)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageCircle size={10} />
                    {fmtK(post.commentsCount)}
                  </span>
                  {post.insights && (
                    <span className="flex items-center gap-0.5">
                      <Bookmark size={10} className="text-amber-400" />
                      {fmtK(post.insights.saved)}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground">{fmtDate(post.timestamp)}</span>
              </div>

              {/* Reach bar */}
              {post.insights?.reach != null && (
                <div className="flex items-center gap-1.5">
                  <Share2 size={9} className="text-purple-400 shrink-0" />
                  <span className="text-[10px] text-muted-foreground">
                    {fmtK(post.insights.reach)} alcance
                  </span>
                  {post.insights.shares > 0 && (
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      {fmtK(post.insights.shares)} shares
                    </span>
                  )}
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
