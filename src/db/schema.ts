import {
  boolean,
  customType,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Postgres tstzrange, serialized as its text form, e.g. ["2026-07-09 18:00:00+00","2026-07-09 18:15:00+00") */
export const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  },
});

export const userRole = pgEnum("user_role", ["customer", "creator", "admin"]);

export const creatorStatus = pgEnum("creator_status", [
  "pending",
  "active",
  "suspended",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending_approval",
  "confirmed",
  "completed",
  "declined",
  "cancelled",
  "refunded",
  "no_show_customer",
  "no_show_creator",
]);

// --- auth tables (shape required by better-auth, usePlural) ---

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("customer"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- domain tables ---

export const creators = pgTable("creators", {
  userId: text("user_id")
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
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const availabilityRules = pgTable("availability_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creators.userId, { onDelete: "cascade" }),
  /** 0 = Sunday … 6 = Saturday, in the creator's timezone */
  weekday: integer("weekday").notNull(),
  /** minutes from local midnight, e.g. 9:00 = 540 */
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creators.userId),
  customerId: text("customer_id")
    .notNull()
    .references(() => users.id),
  slot: tstzrange("slot").notNull(),
  status: bookingStatus("status").notNull(),
  priceCents: integer("price_cents").notNull(),
  paymentIntentId: text("payment_intent_id"),
  roomName: text("room_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
