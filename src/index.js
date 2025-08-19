import 'dotenv/config';
import config from './config.js';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Sequelize } from 'sequelize';
import db from '../database/index.js';
import Ticket from '../database/models/Ticket.js';
import TicketConfig from '../database/models/TicketConfig.js';
import { loadEvents } from './utils/loadEvents.js';
import { loadCommands } from './utils/loadCommands.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});

// Init DB
await db.authenticate();
console.log('Connected to DB');
Ticket.init(db);
TicketConfig.init(db);
await Ticket.sync({ force: true });
await TicketConfig.sync({ force: true });

// Load handlers
await loadEvents(client);
client.commands = await loadCommands();

// Start bot
client.login(config.bot.token);
