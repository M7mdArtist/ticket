import 'dotenv/config';

export default {
  bot: {
    token: process.env.BOT_TOKEN,
    id: process.env.CLIENT_ID,
  },
  database: {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    host: process.env.DB_HOST,
  },
  guild: {
    id: process.env.GUILD_ID,
  },
};
