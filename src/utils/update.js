import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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

      const guild = await client.guilds.fetch(config.guild.id, { force: true });
      if (!guild) {
        console.error('Guild not found.');
        process.exit(1);
      }

      const ownerId = guild.ownerId;
      const channel = await guild.channels.fetch(channelId).catch(() => null);

      if (!channel) {
        console.error('Channel not found or bot has no access.');
        process.exit(1);
      }

      const updateEmbed = new EmbedBuilder()
        .setTitle('🚀 Bot Update Available!')
        .setDescription(
          `Hello <@${ownerId}>,\n\n` +
            `We’re excited to announce a **new update** to the bot with awesome improvements:\n\n` +
            `✨ **Setup is now easier** — no need to copy role IDs anymore.\n` +
            `🔧 New commands: \`/role add\`, \`/role remove\`, \`/role list\`\n\n` +
            `⚠️ **Important Note:**\n` +
            `Old tickets **cannot be claimed, unclaimed, closed, or have transcripts created** once you update.\n` +
            `We strongly recommend that you **close all open tickets before getting the new update**.\n\n` +
            `➡️ To get the updated bot, DM <@607616907033444363>.`
        )
        .setColor(0x00bfff)
        .setFooter({ text: 'Thank you for using our bot 💙' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('💬 Contact Developer')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com/users/607616907033444363')
      );

      await channel.send({ content: `<@${ownerId}>`, embeds: [updateEmbed], components: [row] });
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
