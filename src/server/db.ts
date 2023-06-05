import { InferModel } from "drizzle-orm";
import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  drizzle,
  PlanetScaleDatabase,
} from "drizzle-orm/planetscale-serverless";
import { AdapterAccount } from "next-auth/adapters";

import { connect } from "@planetscale/database";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  username: varchar("username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: varchar("image", { length: 255 }),
  onboarded: boolean("onboarded").default(false).notNull(),

  outfitPostCount: int("outfitPostCount").default(0),
  hoodiePostCount: int("hoodiePostCount").default(0),
  shirtPostCount: int("shirtPostCount").default(0),
  pantsPostCount: int("pantsPostCount").default(0),
  shoesPostCount: int("shoesPostCount").default(0),
  watchPostCount: int("watchPostCount").default(0),
  imageCount: int("imageCount").default(0),
  likeCount: int("likeCount").default(0),
});

export type User = InferModel<typeof users>;

export const accounts = mysqlTable(
  "accounts",
  {
    userId: varchar("userId", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
  })
);

export const sessions = mysqlTable("sessions", {
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().primaryKey(),
  userId: varchar("userId", { length: 255 }).notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = mysqlTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
  })
);

export const posts = mysqlTable("posts", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .defaultNow()
    .onUpdateNow(),
  userId: varchar("userId", { length: 255 }).notNull(),

  type: mysqlEnum("type", [
    "OUTFIT",
    "HOODIE",
    "SHIRT",
    "PANTS",
    "SHOES",
    "WATCH",
  ]).notNull(),
  image: varchar("image", { length: 255 }).notNull(),
});

export type Post = InferModel<typeof posts>;

export enum PostType {
  OUTFIT = "OUTFIT",
  HOODIE = "HOODIE",
  SHIRT = "SHIRT",
  PANTS = "PANTS",
  SHOES = "SHOES",
  WATCH = "WATCH",
}

const globalForDb = globalThis as unknown as {
  db: PlanetScaleDatabase<Schema> | undefined;
};

const connection = connect({
  url: process.env.DATABASE_URL,
});

export const db = drizzle(connection, {
  schema: {
    users,
    accounts,
    sessions,
    verificationTokens,
    posts,
  },
});

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type DbClient = typeof db;

export type Schema = {
  users: typeof users;
  accounts: typeof accounts;
  sessions: typeof sessions;
  verificationTokens: typeof verificationTokens;
  posts: typeof posts;
};
