import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available ticket commands and setup instructions'),

  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🎫 Ticket System | Help Menu')
      .setDescription(
        'Welcome to the upgraded Ticket Bot! Below is a list of all commands categorized by their use. \n\n' +
          '**Quick Setup Guide:**\n' +
          '1️⃣ Use `/category add` to create ticket types (Support, Billing, etc.)\n' +
          '2️⃣ Use `/role add` to authorize your staff team.\n' +
          '3️⃣ Use `/panel` to deploy the ticket dropdown menu.',
      )
      .addFields(
        {
          name: '⚙️ Administrative (Setup)',
          value:
            '`/category add` - Create a new ticket type\n' +
            '`/category remove` - Delete a ticket type\n' +
            '`/panel` - Send the ticket selection dropdown\n' +
            '`/logs set` - Configure logging for a category or global system',
          inline: false,
        },
        {
          name: '🛡️ Staff Management',
          value:
            '`/role add` - Grant a role staff permissions\n' +
            '`/role remove` - Revoke staff permissions\n' +
            '`/role list` - View authorized staff roles',
          inline: false,
        },
        {
          name: '👥 Ticket Interaction',
          value:
            '`/user add` - Invite a user to a specific ticket\n' +
            '`/user remove` - Remove a user from a ticket\n' +
            '`/user list` - See everyone inside the ticket',
          inline: false,
        },
        {
          name: '🎮 Button Actions',
          value:
            '**Claim:** Takes ownership of a ticket.\n' +
            '**Unclaim:** Puts the ticket back in the queue.\n' +
            '**Close:** Request or confirm ticket closure.\n' +
            '**Reopen:** Restores a closed ticket to active status.',
          inline: false,
        },
      )
      .setColor('#77B255')
      .setThumbnail(interaction.guild.iconURL())
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  },
};
