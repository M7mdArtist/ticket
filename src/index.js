import 'dotenv/config';
import config from './config.js';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import db from '../database/index.js';
import Ticket from '../database/models/Ticket.js';
import TicketConfig from '../database/models/TicketConfig.js';
import { loadEvents } from './utils/loadEvents.js';
import { loadCommands } from './utils/loadCommands.js';
import { loadButtons } from './utils/loadButtons.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});
// Check dev
const type = config.bot.type === 'dev';
// Init DB
await db.authenticate();
console.log('Connected to DB');
Ticket.init(db);
TicketConfig.init(db);
if (type) {
  // If in DEV mode: Wipe it and start fresh
  console.log('🛠️ Dev mode detected: Rebuilding database... (force)');
  await Ticket.sync({ force: true });
  await TicketConfig.sync({ force: true });
} else {
  // If in PROD mode: Safely inject new columns without dropping data
  console.log('🚀 Prod mode detected: Updating database safely... (alter)');
  await Ticket.sync({ alter: true });
  await TicketConfig.sync({ alter: true });
}

// Load handlers
await loadEvents(client);
await loadButtons(client);
client.commands = await loadCommands();

// Start bot
client.login(config.bot.token);
