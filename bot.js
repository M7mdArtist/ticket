require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder,
  Routes,
  REST,
  ChannelManager,
  EmbedBuilder,
} = require('discord.js');
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

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the ticket system (server owner only)')
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('The category ID for tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('roles').setDescription('Comma-separated role IDs that have access to tickets').setRequired(true)
    ),
  new SlashCommandBuilder().setName('delete').setDescription('Delete all closed tickets'),
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log('Bot is online');

  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Successfully registered slash commands');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }

  db.authenticate()
    .then(() => {
      console.log('Connected to DB');
      Ticket.init(db);
      TicketConfig.init(db);
      Ticket.sync({ force: true });
      TicketConfig.sync({ force: true });
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

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'setup') {
    // Only server owner can use this command
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: 'Only the server owner can use this command.', ephemeral: true });
    }

    try {
      const categoryId = interaction.options.getChannel('category').id;
      const roles = interaction.options.getString('roles').split(/,\s*/);

      await interaction.deferReply({ ephemeral: true });

      const msg = await interaction.channel.send('react with 🎫 to this message to open a ticket 🤙');
      console.log(`message Id: ${msg.id}`);

      const fetchMsg = await interaction.channel.messages.fetch(msg.id);

      const categoryChannel = client.channels.cache.get(categoryId);

      if (!categoryChannel) {
        throw new Error('Invalid category ID');
      }

      for (const roleId of roles) {
        if (!interaction.guild.roles.cache.get(roleId)) {
          console.log(`Role ${roleId} does not exist`);
          throw new Error(`Role ${roleId} does not exist`);
        }
      }

      const roleObjects = [];
      for (const roleId of roles) {
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) throw new Error(`Role ${roleId} not found`);
        roleObjects.push(role);
      }

      const deleteChannel = await interaction.guild.channels.create({
        name: 'delete-closed-tickets',
        type: ChannelType.GuildText,
        parent: interaction.channel.parentId,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
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

      deleteChannel.send('Use **/delete** to delete all closed tickets.');

      const ticketConfig = await TicketConfig.create({
        messageId: msg.id,
        guildId: interaction.guild.id,
        roles: JSON.stringify(roles),
        parentId: categoryChannel.id,
        deleteTicketsChannelId: deleteChannel.id,
      });
      console.log(ticketConfig);

      await fetchMsg.react('🎫');
      await interaction.editReply({ content: 'Ticket system setup complete!' });
    } catch (err) {
      console.error('Setup error:', err);
      interaction.editReply({ content: `Error during setup: ${err.message}` });
    }
  }

  if (interaction.commandName === 'delete') {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!ticketConfig) {
        return interaction.reply({ content: 'Ticket system not configured for this server.', ephemeral: true });
      }

      if (interaction.channel.id !== ticketConfig.getDataValue('deleteTicketsChannelId')) {
        return interaction.reply({
          content: 'This command can only be used in the delete-closed-tickets channel.',
          ephemeral: true,
        });
      }

      // await interaction.deferReply();

      const deleteCount = await deleteClosedTickets(interaction.guild, ticketConfig.getDataValue('parentId'), 'closed');
      if (deleteCount === 0) {
        await interaction.reply({ content: 'There are no closed tickets to delete.', ephemeral: true });
      } else {
        const date = new Date();
        const unixNow = Math.floor(date.getTime() / 1000);

        const deleteEmbed = new EmbedBuilder()
          .setTitle('Delete Info')
          .addFields(
            { name: 'deleted:', value: `${deleteCount} tickets`, inline: true },
            { name: 'used by:', value: interaction.user.tag, inline: true },
            { name: 'date:', value: `<t:${unixNow}:D>`, inline: true }
          );

        interaction.reply({ embeds: [deleteEmbed] });
      }
    } catch (error) {
      console.error('Error in delete command:', error);
      await interaction.reply({ content: 'An error occurred while deleting tickets.', ephemeral: true });
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || message.channel.type === 'DM') return;

  const ticketConfig = await TicketConfig.findOne({ where: { deleteTicketsChannelId: message.channel.id } });

  try {
    if (!ticketConfig) {
      console.log('there is no ticket config for this channel');
      return;
    }

    if (message.channel.id === ticketConfig.deleteTicketsChannelId) {
      await message.delete().catch(console.error);
    }
  } catch (error) {
    console.error('error in message delete handler', error);
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
