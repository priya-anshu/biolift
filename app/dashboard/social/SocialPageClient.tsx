"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  Bell,
  Flag,
  Flame,
  Hash,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Shield,
  Smile,
  ThumbsUp,
  Trophy,
  Users,
  Video as VideoIcon,
} from "lucide-react";
import { useState } from "react";

type SocialPost = {
  id: string;
  author: string;
  handle: string;
  time: string;
  avatar: string;
  text: string;
  image: string;
  likes: number;
  comments: number;
};

const accentClasses =
  "from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600";

const samplePosts: SocialPost[] = [
  {
    id: "post-1",
    author: "Priyanshu Dhyani",
    handle: "@priyanshu",
    time: "2h ago",
    avatar:
      "https://lh3.googleusercontent.com/a/ACg8ocJqi3TrOIJVlcIUuaPBjPrvRJOcOlenyTKgkK5W3RYEJ_AtxkI=s96-c",
    text: "Hit a new PR today! 220kg deadlift and feeling unstoppable.",
    image: "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg",
    likes: 128,
    comments: 18,
  },
  {
    id: "post-2",
    author: "BioLift Coach",
    handle: "@biolift",
    time: "6h ago",
    avatar: "",
    text: "Reminder: hydrate and stretch between sets. Small habits, big wins.",
    image: "",
    likes: 92,
    comments: 12,
  },
];

const reactionCounts: Record<string, Record<string, number>> = {
  "post-1": {
    "ðŸ‘": 3,
    "ðŸ”¥": 2,
    "ðŸ‘": 1,
    "ðŸ’ª": 4,
  },
  "post-2": {
    "ðŸ‘": 2,
    "ðŸ”¥": 1,
    "ðŸ‘": 0,
    "ðŸ’ª": 2,
  },
};

function PostComposer() {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="flex items-start space-x-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${accentClasses} font-bold text-white`}
        >
          Y
        </div>

        <div className="flex-1 space-y-3">
          <input
            placeholder="Share an update with your gym... @mention, #tags"
            className="w-full rounded-lg border border-day-border bg-day-card px-4 py-3 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-day-text-secondary dark:text-night-text-secondary">
              <button
                type="button"
                className="rounded-lg px-3 py-2 transition hover:bg-day-hover dark:hover:bg-night-hover"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-2 transition hover:bg-day-hover dark:hover:bg-night-hover"
              >
                <VideoIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-2 transition hover:bg-day-hover dark:hover:bg-night-hover"
              >
                <Smile className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
            >
              Post
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentList({ count }: { count: number }) {
  return (
    <div className="mt-3 space-y-3">
      {count > 0 ? (
        <div className="flex items-start space-x-3">
          <div className="h-8 w-8 rounded-full bg-day-border dark:bg-night-border" />
          <div>
            <div className="text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
              Community member
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Join the conversation on this post.
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center space-x-2">
        <input
          placeholder="Write a comment..."
          className="w-full rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
        />
        <button
          type="button"
          className="rounded-full border border-day-border px-3 py-2 text-sm font-medium text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
        >
          Reply
        </button>
      </div>
    </div>
  );
}

function SpotlightCard() {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
          Weekly Member Spotlight
        </h3>
      </div>
      <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
        Congrats to Alex for a 7-day streak!
      </p>
    </div>
  );
}

function TrendingCard() {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="mb-2 flex items-center gap-2">
        <Flame className="h-5 w-5 text-red-500" />
        <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
          Trending Posts
        </h3>
      </div>
      <ul className="space-y-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
        <li>#mobility tips</li>
        <li>#protein talk</li>
        <li>#new class schedule</li>
      </ul>
    </div>
  );
}

function PollCard() {
  const [choice, setChoice] = useState("");
  const [voted, setVoted] = useState(false);
  const options = ["New yoga slot", "Weekend bootcamp", "Nutrition webinar"];

  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <h3 className="mb-2 font-semibold text-day-text-primary dark:text-night-text-primary">
        Weekly Poll
      </h3>

      <div className="space-y-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              name="social-poll"
              checked={choice === option}
              onChange={() => setChoice(option)}
            />
            <span className="text-sm text-day-text-primary dark:text-night-text-primary">
              {option}
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 rounded-full bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
        onClick={() => setVoted(true)}
      >
        Vote
      </button>

      {voted ? (
        <div className="mt-3 text-xs text-day-text-secondary dark:text-night-text-secondary">
          Thanks for voting! Results soon.
        </div>
      ) : null}
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="mb-2 flex items-center gap-2">
        <Bell className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
        <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
          Notifications
        </h3>
      </div>
      <ul className="space-y-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
        <li>
          <ThumbsUp className="mr-1 inline h-4 w-4" />
          Mike liked your post
        </li>
        <li>
          <MessageCircle className="mr-1 inline h-4 w-4" />
          Sarah commented on your video
        </li>
        <li>
          <Users className="mr-1 inline h-4 w-4" />
          Trainer mentioned you
        </li>
      </ul>
    </div>
  );
}

function ModerationTools() {
  return (
    <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="mb-2 flex items-center gap-2">
        <Shield className="h-5 w-5" />
        <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
          Moderation
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-day-border px-3 py-2 text-sm font-medium text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
        >
          <Flag className="h-4 w-4" />
          Reports
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-day-border px-3 py-2 text-sm font-medium text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
        >
          <Users className="h-4 w-4" />
          Manage Members
        </button>
      </div>
    </div>
  );
}

function PostCard({
  post,
  liked,
  pinned,
  onLike,
  onTogglePinned,
}: {
  post: SocialPost;
  liked: boolean;
  pinned: boolean;
  onLike: () => void;
  onTogglePinned: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const role = post.author === "BioLift Coach" ? "Trainer" : "Member";
  const reactions = reactionCounts[post.id] ?? { "ðŸ‘": 0, "ðŸ”¥": 0, "ðŸ‘": 0, "ðŸ’ª": 0 };

  return (
    <div className="relative rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${accentClasses} font-bold text-white`}
          >
            {post.author[0]}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                {post.author}
              </span>
              <span className="rounded-full border border-day-border px-2.5 py-0.5 text-xs font-medium text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                {role}
              </span>
              {pinned ? <span className="text-xs text-yellow-500">Pinned</span> : null}
            </div>
            <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              {post.time}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            className="p-1 text-day-text-secondary transition hover:text-day-text-primary dark:text-night-text-secondary dark:hover:text-night-text-primary"
            onClick={() => setShowMenu((current) => !current)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {showMenu ? (
            <div className="absolute right-0 z-10 mt-2 w-32 rounded-lg bg-white shadow-lg dark:bg-night-surface">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-day-hover dark:hover:bg-night-hover"
                onClick={() => {
                  onTogglePinned();
                  setShowMenu(false);
                }}
              >
                {pinned ? "Unpin Post" : "Pin Post"}
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-day-hover dark:hover:bg-night-hover"
                onClick={() => setShowMenu(false)}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {post.text ? (
        <p className="mt-3 text-day-text-primary dark:text-night-text-primary">{post.text}</p>
      ) : null}

      {post.image ? (
        <div className="mt-3 overflow-hidden rounded-lg">
          <div className="relative h-80 w-full">
            {/* External UI-reference image URLs intentionally bypass next/image host config. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image}
              alt="Post media"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-day-text-secondary dark:text-night-text-secondary">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onLike}
            className="flex items-center gap-1 transition hover:text-day-text-primary dark:hover:text-night-text-primary"
          >
            <Heart className="h-4 w-4" />
            {post.likes + (liked ? 1 : 0)}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 transition hover:text-day-text-primary dark:hover:text-night-text-primary"
          >
            <MessageCircle className="h-4 w-4" />
            {post.comments}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 transition hover:text-day-text-primary dark:hover:text-night-text-primary"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(["ðŸ‘", "ðŸ”¥", "ðŸ‘", "ðŸ’ª"] as const).map((emoji) => (
            <button
              key={`${post.id}-${emoji}`}
              type="button"
              className="rounded px-2 py-1 transition hover:bg-day-hover dark:hover:bg-night-hover"
            >
              {emoji} {reactions[emoji] ?? 0}
            </button>
          ))}
        </div>
      </div>

      <CommentList count={post.comments} />

      <div className="mt-3 flex items-center gap-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
        <Hash className="h-3 w-3" />
        <span>#training</span>
        <AtSign className="ml-3 h-3 w-3" />
        <span>@trainer</span>
      </div>
    </div>
  );
}

export default function SocialPageClient() {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
          Community Feed
        </h1>
        <p className="text-day-text-secondary dark:text-night-text-secondary">
          Private space for members, trainers, and owner
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PostComposer />

          <AnimatePresence>
            {samplePosts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <PostCard
                  post={post}
                  liked={Boolean(liked[post.id])}
                  pinned={Boolean(bookmarked[post.id])}
                  onLike={() =>
                    setLiked((current) => ({
                      ...current,
                      [post.id]: !current[post.id],
                    }))
                  }
                  onTogglePinned={() =>
                    setBookmarked((current) => ({
                      ...current,
                      [post.id]: !current[post.id],
                    }))
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <NotificationsPanel />
          <TrendingCard />
          <PollCard />
          <SpotlightCard />
          <ModerationTools />
        </div>
      </div>
    </div>
  );
}
