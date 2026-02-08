"use client";

import { motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import Image from "next/image";
const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const samplePosts = [
  {
    id: "post-1",
    author: "Priyanshu Dhyani",
    handle: "@priyanshu",
    time: "2h ago",
    avatar:
      "https://lh3.googleusercontent.com/a/ACg8ocJqi3TrOIJVlcIUuaPBjPrvRJOcOlenyTKgkK5W3RYEJ_AtxkI=s96-c",
    text: "Hit a new PR today! 220kg deadlift and feeling unstoppable. 🔥",
    image:
      "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg",
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

const suggestedFriends = [
  { name: "Anika Sharma", handle: "@anikas", mutual: "5 mutuals" },
  { name: "Rohan Mehta", handle: "@rohanm", mutual: "3 mutuals" },
  { name: "Mia Chen", handle: "@miafit", mutual: "7 mutuals" },
];

export default function SocialPage() {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});

  const trendingTags = useMemo(
    () => ["#HIIT", "#Strength", "#Mobility", "#Nutrition", "#Recovery"],
    [],
  );

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Social Hub</h1>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Share progress, motivate friends, and celebrate milestones.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-night-accent">
            <Plus className="h-4 w-4" />
            Create Post
          </button>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-day-hover text-sm font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                You
              </div>
              <div className="flex-1">
                <input
                  placeholder="Share your progress..."
                  className="w-full rounded-full border border-day-border bg-day-card px-4 py-2 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
                />
              </div>
              <button className="rounded-full border border-day-border p-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button className="rounded-full bg-day-accent-primary p-2 text-white dark:bg-night-accent">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {samplePosts.map((post, index) => {
            const isLiked = liked[post.id];
            const isBookmarked = bookmarked[post.id];
            return (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * (index + 1) }}
                className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-day-hover text-sm font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                    {post.avatar ? (
                      <Image
                        src={post.avatar}
                        alt={post.author}
                        className="h-full w-full object-cover"
                        width={44}
                        height={44}
                      />
                    ) : (
                      post.author[0]
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {post.author}
                      <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {post.handle}
                      </span>
                    </div>
                    <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {post.time}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setBookmarked((prev) => ({
                        ...prev,
                        [post.id]: !prev[post.id],
                      }))
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      isBookmarked
                        ? "border-transparent bg-day-accent-primary text-white dark:bg-night-accent"
                        : "border-day-border text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                    }`}
                  >
                    {isBookmarked ? "Saved" : "Save"}
                  </button>
                </div>
                <p className="mt-4 text-sm text-day-text-primary dark:text-night-text-primary">
                  {post.text}
                </p>
                {post.image ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-day-border dark:border-night-border">
                    <Image
                      src={post.image}
                      alt="Workout post"
                      className="h-64 w-full object-cover"
                      width={640}
                      height={456}
                    />
                  </div>
                ) : null}
                <div className="mt-4 flex items-center justify-between text-sm text-day-text-secondary dark:text-night-text-secondary">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        setLiked((prev) => ({
                          ...prev,
                          [post.id]: !prev[post.id],
                        }))
                      }
                      className={`flex items-center gap-2 rounded-full px-3 py-1 transition ${
                        isLiked
                          ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
                          : "hover:bg-day-hover dark:hover:bg-night-hover"
                      }`}
                    >
                      <Heart className="h-4 w-4" />
                      {post.likes + (isLiked ? 1 : 0)}
                    </button>
                    <div className="flex items-center gap-2 rounded-full px-3 py-1 hover:bg-day-hover dark:hover:bg-night-hover">
                      <MessageCircle className="h-4 w-4" />
                      {post.comments}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    {isBookmarked ? "Bookmarked" : "Save for later"}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Trending Tags
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-day-border px-3 py-1 text-xs font-semibold text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Suggested Friends
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {suggestedFriends.map((friend) => (
                <div
                  key={friend.handle}
                  className="flex items-center justify-between rounded-xl border border-day-border px-3 py-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                >
                  <div>
                    <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                      {friend.name}
                    </div>
                    <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {friend.mutual}
                    </div>
                  </div>
                  <button className="rounded-full bg-day-accent-primary px-3 py-1 text-xs font-semibold text-white dark:bg-night-accent">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Community Alerts
            </div>
            <div className="mt-3 space-y-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              <div className="rounded-xl border border-day-border px-3 py-2 dark:border-night-border">
                New challenge: 5-day mobility reset.
              </div>
              <div className="rounded-xl border border-day-border px-3 py-2 dark:border-night-border">
                Live coaching session starts at 6 PM.
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
