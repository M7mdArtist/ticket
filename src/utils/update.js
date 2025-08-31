import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import mysql from 'mysql2/promise';
import config from '../config.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function sendUpdateMessage() {
  try {
    const db = await mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.pass,
      database: config.database.name,
    });

    const [rows] = await db.execute('SELECT channelId FROM TicketConfigs WHERE guildId = ? LIMIT 1', [config.guild.id]);

    const fallbackChannelId = '1409495052526420089'; // fallback channel if DB has nothing
    const channelId = rows.length ? rows[0].channelId : fallbackChannelId;

    await client.login(config.bot.token);

    client.once('ready', async () => {
      console.log(`Logged in as ${client.user.tag}`);

      // Fetch the guild fully
      const guild = await client.guilds.fetch(config.guild.id, { force: true });

      if (!guild) {
        console.error('Guild not found.');
        process.exit(1);
      }

      const ownerId = guild.ownerId; // safe owner ID
      const channel = await guild.channels.fetch(channelId).catch(() => null);

      if (!channel) {
        console.error('Channel not found or bot has no access.');
        process.exit(1);
      }

      const updateEmbed = new EmbedBuilder()
        .setTitle('🎉 Ticket V2.0 Update Available!')
        .setDescription(
          `Hey <@${ownerId}>, the **Ticket Bot** has just been updated!\n\n` +
            `Use the new features and commands to keep your server smooth!`
        )
        .addFields(
          {
            name: '🆕 New Features',
            value:
              `• New look, less bugs, faster tickets ⚡\n` +
              `• Users now request to close tickets instead of closing directly\n` +
              '• Bug fixes 🔧',
          },
          {
            name: '📥 How to Update',
            value: `To get the latest update, DM <@607616907033444363>.`,
          },
          {
            name: '🐞 Bugs & Suggestions',
            value: `If you find bugs or want new features, DM <@607616907033444363>.`,
          }
        )
        .setColor(0x00ff99)
        .setTimestamp()
        .setFooter({ text: 'Ticket Bot V2 Update' });

      await channel.send({ content: `<@${ownerId}>`, embeds: [updateEmbed] });
      console.log('✅ Update message sent!');

      await db.end();
      client.destroy();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error sending update message:', error);
    process.exit(1);
  }
}

sendUpdateMessage();
