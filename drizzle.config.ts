import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db.ts",
  connectionString:
    'mysql://tp9g8s465azdno6js5v5:pscale_pw_FN6KQJjUy0BNYlOvWg1O1RdH3HFkAKOY6uJ8kodos7b@aws.connect.psdb.cloud/outfits?ssl={"rejectUnauthorized":true}',
} satisfies Config;
