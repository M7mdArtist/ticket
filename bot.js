require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});
const db = require('./database');
const Ticket = require('./models/Ticket');
const TicketConfig = require('./models/TicketConfig');

client.once('ready', () => {
  console.log('Bot is online');
  db.authenticate()
    .then(() => {
      console.log('Connected to DB');
      Ticket.init(db);
      TicketConfig.init(db);
      Ticket.sync(); //add { force: true } to reset the database every time restarting the bot
      TicketConfig.sync(); //add { force: true } to reset the database every time restarting the bot
    })
    .catch(err => console.log('Database connection error:', err));
});

async function deleteClosedTickets(guild, categoryId, searchText) {
  try {
    const category = guild.channels.cache.get(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return console.log('Invalid category ID or not a category channel');
    }
    const channels = category.children.cache.filter(
      channel => channel.type === ChannelType.GuildText && channel.name.includes(searchText)
    );

    let deleteCount = 0;
    for (const [id, channel] of channels) {
      try {
        await channel.delete();
        console.log(`Deleted Channel: ${channel.name}, total: ${deleteCount}`);
        deleteCount++;
      } catch (error) {
        console.error(`Failed delete channel ${channel.name}:`, error);
      }
    }
    return deleteCount;
  } catch (error) {
    console.error('Error in deleteChannelsInCategoryWithText:', error);
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot || message.channel.type === 'DM') return;

  if (message.content.toLowerCase() === '?setup' && message.guild.ownerId === message.author.id) {
    try {
      const filter = m => m.author.id === message.author.id;
      const msg = await message.channel.send('react with 🎫 to this message to open a ticket 🤙');
      console.log(`message Id: ${msg.id}`);

      const fetchMsg = await message.channel.messages.fetch(msg.id);

      await message.channel.send('Please enter the category ID for this ticket');
      const categoryId = (await message.channel.awaitMessages({ filter, max: 1 })).first().content;

      const categoryChannel = client.channels.cache.get(categoryId);

      await message.channel.send('Please enter all of the roles that have access to tickets (comma separated)');
      const roles = (await message.channel.awaitMessages({ filter, max: 1 })).first().content.split(/,\s*/);

      if (fetchMsg && categoryChannel) {
        for (const roleId of roles)
          if (!message.guild.roles.cache.get(roleId)) {
            console.log(`Role ${roleId} does not exist`);
            throw new Error(`Role ${roleId} does not exist`);
          }

        const currentCategory = message.channel.parent;

        const roleObjects = [];
        for (const roleId of roles) {
          const role = await message.guild.roles.fetch(roleId).catch(() => null);
          if (!role) throw new Error(`Role ${roleId} not found`);
          roleObjects.push(role);
        }

        const deleteChannel = await message.guild.channels.create({
          name: 'delete-closed-tickets',
          type: ChannelType.GuildText,
          parent: message.channel.parent.id,
          permissionOverwrites: [
            {
              id: message.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            ...roleObjects.map(role => ({
              id: role.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
              ],
            })),
          ],
        });

        deleteChannel.send('Use **"?delete"** to delete all closed tickets.');

        const ticketConfig = await TicketConfig.create({
          messageId: msg.id,
          guildId: message.guild.id,
          roles: JSON.stringify(roles),
          parentId: categoryChannel.id,
          deleteTicketsChannelId: deleteChannel.id,
        });
        console.log(ticketConfig);
        message.channel.send('Configuration saved to DB');
        await fetchMsg.react('🎫');
      } else throw new Error('Invalid fields');
    } catch (err) {
      console.error('Setup error:', err);
      message.channel.send(`Error during setup: ${err.message}`);
    }
  }

  if (message.content.toLowerCase() === '?delete') {
    const ticketConfig = await TicketConfig.findOne({ where: { guildId: message.guild.id } });
    if (message.channel.id !== ticketConfig.getDataValue('deleteTicketsChannelId')) return;

    const deleteCount = await deleteClosedTickets(message.guild, ticketConfig.getDataValue('parentId'), 'closed');
    if (deleteCount === 0) {
      message.reply('There is no closed tickets to delete.');
    } else {
      message.reply(`Delete all closed tickets, \n **Total Tickets: ${deleteCount}**`);
    }
  }
});

const userTickets = {};

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  // Handle ticket creation reaction
  if (reaction.emoji.name === '🎫') {
    await reaction.users.remove(user.id).catch(console.error);

    if (userTickets[user.id]?.active) {
      user.send('You already have an open ticket. Please close it before opening a new one.');
      return;
    }
    userTickets[user.id] = { active: true };

    const ticketConfig = await TicketConfig.findOne({ where: { messageId: reaction.message.id } });

    if (ticketConfig) {
      await reaction.users.remove(user.id).catch(console.error);
      const findTicket = await Ticket.findOne({ where: { authorId: user.id, resolved: false } });
      if (findTicket) {
        user.send('You already have an open ticket. Please close it before opening a new one.');
        return;
      }

      clearTimeout(userTickets[user.id].timeout);

      console.log('Creating a ticket');

      try {
        userTickets[user.id].timeout = setTimeout(async () => {
          const roleIdsString = ticketConfig.getDataValue('roles');
          const roleIds = JSON.parse(roleIdsString);
          const permissions = roleIds.map(id => ({
            allow: [PermissionsBitField.Flags.ViewChannel],
            id,
          }));

          const channel = await reaction.message.guild.channels.create({
            name: 'ticket',
            parent: ticketConfig.getDataValue('parentId'),
            permissionOverwrites: [
              {
                deny: [PermissionsBitField.Flags.ViewChannel],
                id: reaction.message.guild.id,
              },
              {
                allow: [PermissionsBitField.Flags.ViewChannel],
                id: user.id,
              },
              ...permissions,
            ],
          });

          const msg = await channel.send(
            `## 🎫 This ticket was opened by ${user} \n > 💾 Your ticket will be saved. \n React with this emoji 🔏 to close the ticket.`
          );
          await msg.react('🔏');

          let ticket = await Ticket.create({
            authorId: user.id,
            channelId: channel.id,
            guildId: reaction.message.guild.id,
            resolved: false,
            closedMessageId: msg.id,
          });

          const ticketId = String(ticket.getDataValue('ticketId')).padStart(4, '0');
          await channel.edit({ name: `ticket-${ticketId}` });
        }, 1000 * 2);
      } catch (err) {
        console.log(err);
      }
    } else {
      console.log('No ticket config found');
    }
  }
  // Handle ticket closing reaction
  else if (reaction.emoji.name === '🔏') {
    try {
      const ticket = await Ticket.findOne({
        where: {
          channelId: reaction.message.channel.id,
          resolved: false,
        },
      });

      if (!ticket) return;

      const msg = await reaction.message.channel.send('Are you sure you want to close this ticket?');
      await msg.react('✅');
      await msg.react('❌');

      const filter = (reaction, user) => {
        return ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;
      };

      const collector = msg.createReactionCollector({
        filter,
        time: 15000,
        max: 1,
      });

      collector.on('collect', async reaction => {
        if (reaction.emoji.name === '❌') {
          await reaction.message.channel.send('Closing ticket canceled');
          return;
        } else if (reaction.emoji.name === '✅') {
          console.log('Closing ticket...');

          try {
            await reaction.message.channel.send('🔏 Closing ticket...');
            await reaction.message.channel.permissionOverwrites.edit(ticket.authorId, { ViewChannel: false });

            await ticket.update({
              resolved: true,
              closedMessageId: reaction.message.id,
            });

            userTickets[ticket.authorId].active = false;
            userTickets[ticket.authorId].timeout && clearTimeout(userTickets[ticket.authorId].timeout);

            const ticketChannel = reaction.message.channel;
            await ticketChannel.edit({ name: `${ticketChannel.name}-closed` });

            await reaction.message.channel.send('Ticket closed successfully 🤙');
            console.log('Ticket closed successfully');
          } catch (err) {
            console.error('Error closing ticket:', err);
          }
        }
      });

      collector.on('end', async collected => {
        if (collected.size === 0) {
          try {
            const editedMsg = await msg.edit('Ticket confirmation timed out.\n **Closing ticket canceled**');
            setTimeout(async () => {
              try {
                await editedMsg.delete();
              } catch (deleteError) {
                console.error('Failed to delete message:', deleteError);
              }
            }, 5000);
          } catch (editError) {
            console.error('Failed to edit message:', editError);
          }
        }
      });
    } catch (err) {
      console.error('Error in ticket closing process:', err);
    }
  }
});

client.login(process.env.BOT_TOKEN);
