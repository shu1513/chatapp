import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "creator", "admin"]);

export const creatorStatus = pgEnum("creator_status", [
  "pending",
  "active",
  "suspended",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: userRole("role").notNull().default("customer"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const creators = pgTable("creators", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  rateCents: integer("rate_cents").notNull(),
  callLengthMin: integer("call_length_min").notNull().default(15),
  approvalMode: boolean("approval_mode").notNull().default(false),
  instantRateCentsPerMin: integer("instant_rate_cents_per_min"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  stripeAccountId: text("stripe_account_id"),
  status: creatorStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
