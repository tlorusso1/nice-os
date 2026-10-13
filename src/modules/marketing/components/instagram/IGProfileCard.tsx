import { formatCompact as fmtK } from "../../lib/dataQuality";
import { UserCircle2, ExternalLink, Image, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IGProfile } from "../../hooks/useMarketingData";


interface Props {
  profile: IGProfile;
}

export function IGProfileCard({ profile }: Props) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-start gap-4">
      {/* Avatar */}
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 shrink-0">
        <div className="w-full h-full rounded-full bg-muted overflow-hidden flex items-center justify-center">
          {profile.profilePictureUrl ? (
            <img
              src={profile.profilePictureUrl}
              alt={profile.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserCircle2 size={28} className="text-muted-foreground opacity-40" />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm">@{profile.username}</p>
          <a
            href={`https://instagram.com/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink size={12} />
          </a>
        </div>
        {profile.biography && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{profile.biography}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-2">
          {[
            { icon: Users,  label: "seguidores", value: fmtK(profile.followersCount) },
            { icon: Image,  label: "posts",      value: fmtK(profile.mediaCount)     },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon size={11} className="text-muted-foreground" />
              <span className="text-xs font-semibold">{value}</span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
