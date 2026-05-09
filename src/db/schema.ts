import { pgTable, text, timestamp, boolean, integer, pgEnum, uuid, json } from "drizzle-orm/pg-core";

export const gameChannelEnum = pgEnum("game_channel", ["CODM", "EFOOTBALL", "GENERAL"]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"), // Firebase UID (can be null for guest read-only or future guest chat)
  username: text("username").notNull(),
  avatarId: integer("avatar_id").default(0),
  content: text("content").notNull(),
  game: gameChannelEnum("game").default("GENERAL").notNull(),
  isGif: boolean("is_gif").default(false),
  isReported: boolean("is_reported").default(false),
  reportCount: integer("report_count").default(0),
  likes: json("likes").default([]).notNull(),
  replyToId: uuid("reply_to_id"),
  replyToUser: text("reply_to_user"),
  replyToContent: text("reply_to_content"),
  isSeed: boolean("is_seed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  game: gameChannelEnum("game").default("GENERAL").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
