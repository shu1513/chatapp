import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "../db";
import { sendEmail } from "./email";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "customer",
        input: false,
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.RESEND_API_KEY
        ) {
          throw new Error("RESEND_API_KEY required in production");
        }
        // Dev convenience: keep the link greppable in server logs.
        if (!process.env.RESEND_API_KEY) {
          console.log(`[magic-link] ${email}: ${url}`);
        }
        await sendEmail({
          to: email,
          subject: "Your sign-in link",
          text: `Click to sign in to chatapp:\n\n${url}\n\nThis link expires shortly. If you didn't request it, ignore this email.`,
        });
      },
    }),
  ],
});
