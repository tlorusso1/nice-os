import { formatCompact as fmtK } from "../../lib/dataQuality";
import { Youtube, Eye, Video, Users, ExternalLink } from "lucide-react";
import type { YTChannelStats } from "../../hooks/useMarketingData";


interface Props {
  stats: YTChannelStats;
}

export function YTChannelCard({ stats }: Props) {
  const channelUrl = `https://youtube.com/channel/${stats.id}`;

  return (
    <div className="bg-card border rounded-xl p-4 flex items-start gap-4">
      {/* Thumbnail / logo */}
      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 overflow-hidden flex items-center justify-center shrink-0">
        {stats.thumbnailUrl ? (
          <img src={stats.thumbnailUrl} alt={stats.title} className="w-full h-full object-cover" />
        ) : (
          <Youtube size={24} className="text-red-500" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{stats.title}</p>
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink size={12} />
          </a>
        </div>
        {stats.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{stats.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            {
              icon: Users,
              label: stats.hiddenSubscriberCount ? "Inscritos ocultos" : "inscritos",
              value: stats.hiddenSubscriberCount ? "—" : fmtK(stats.subscriberCount),
              color: "text-red-600 dark:text-red-400",
            },
            { icon: Eye,   label: "visualizações", value: fmtK(stats.viewCount),  color: "text-blue-600 dark:text-blue-400" },
            { icon: Video, label: "vídeos",         value: fmtK(stats.videoCount), color: "text-foreground" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-1">
              <Icon size={11} className="text-muted-foreground" />
              <span className={`text-xs font-semibold ${color}`}>{value}</span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
