import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import mysql from 'mysql2/promise';
import config from '../config.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function sendShutdownMessage() {
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

      const shutdownEmbed = new EmbedBuilder()
        .setTitle('⚠️ Bot Shutdown Notice')
        .setDescription(
          `Hello <@${ownerId}>,\n\n` +
            `This bot will be going **offline permanently** and will **not work again**.\n\n` +
            `But don’t worry! 🎉\nThere is a **new bot available** with the same features and improvements.`
        )
        .setColor(0xff0000)
        .setFooter({ text: 'Thank you for using our bot 💙' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🤖 Invite the New Bot')
          .setStyle(ButtonStyle.Link)
          .setURL(
            'https://discord.com/oauth2/authorize?client_id=1395365522832363641&permissions=8&integration_type=0&scope=bot+applications.commands'
          )
      );

      await channel.send({ content: `<@${ownerId}>`, embeds: [shutdownEmbed], components: [row] });
      console.log('✅ Shutdown message sent!');

      await db.end();
      client.destroy();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error sending shutdown message:', error);
    process.exit(1);
  }
}

sendShutdownMessage();
