require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField, SlashCommandBuilder, ChannelType } = require('discord.js');
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel] 
});
const db = require('./database');
const Ticket = require('./models/Ticket');
const TicketConfig = require('./models/TicketConfig');

// Store ongoing setups
const ongoingSetups = new Map();

client.once('ready', async () => {
    console.log('Bot is online');
    try {
        await db.authenticate();
        console.log('Connected to DB');
        Ticket.init(db);
        TicketConfig.init(db);
        await Ticket.sync();
        await TicketConfig.sync();
        
        // Register slash commands
        await registerCommands();
    } catch (err) {
        console.log('Database connection error:', err);
    }
});

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Setup the ticket system')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    ];

    try {
        // Register commands for all guilds the bot is in
        const guilds = await client.guilds.fetch();
        for (const [id, guild] of guilds) {
            const actualGuild = await guild.fetch();
            await actualGuild.commands.set(commands);
            console.log(`Registered commands for guild: ${actualGuild.name}`);
        }
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'setup') {
        // Check if user is guild owner
        if (interaction.guild.ownerId !== interaction.user.id) {
            return interaction.reply({ 
                content: '❌ Only the server owner can use this command.', 
                ephemeral: true 
            });
        }

        // Check if user already has an ongoing setup
        if (ongoingSetups.has(interaction.user.id)) {
            return interaction.reply({
                content: '❌ You already have a setup in progress. Please complete that first.',
                ephemeral: true
            });
        }

        try {
            // Mark this user as having an ongoing setup
            ongoingSetups.set(interaction.user.id, {
                step: 0,
                data: {}
            });

            // Send the initial reaction message
            const reactionMessage = await interaction.channel.send("React with 🎫 to this message to open a ticket 🤙");
            
            await interaction.reply({ 
                content: `✅ I've created the reaction message: ${reactionMessage.url}\n\nNow please provide: \n1️⃣ The **category ID** where new tickets should be created:`,
                ephemeral: true
            });

            // Store the message ID for later
            ongoingSetups.get(interaction.user.id).data.messageId = reactionMessage.id;

            // Set up collector for user responses
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ 
                filter, 
                time: 300000 // 5 minutes timeout
            });

            collector.on('collect', async (message) => {
                const setup = ongoingSetups.get(interaction.user.id);
                
                try {
                    switch (setup.step) {
                        case 0: // Category ID
                            const category = interaction.guild.channels.cache.get(message.content);
                            if (category && category.type === ChannelType.GuildCategory) {
                                setup.data.categoryId = message.content;
                                setup.step++;
                                await interaction.followUp({
                                    content: '✅ Category ID accepted!\n\n2️⃣ Please enter the **role IDs** that should have access to tickets (comma separated):',
                                    ephemeral: true
                                });
                            } else {
                                await interaction.followUp({
                                    content: '❌ Invalid category ID. Please try again with a valid category ID:',
                                    ephemeral: true
                                });
                            }
                            break;
                            
                        case 1: // Roles
                            const roleIds = message.content.split(/,\s*/);
                            const invalidRoles = [];
                            const validRoles = [];
                            
                            for (const roleId of roleIds) {
                                const role = interaction.guild.roles.cache.get(roleId.trim());
                                if (role) {
                                    validRoles.push(roleId.trim());
                                } else {
                                    invalidRoles.push(roleId.trim());
                                }
                            }
                            
                            if (invalidRoles.length > 0) {
                                await interaction.followUp({
                                    content: `❌ Some roles are invalid: ${invalidRoles.join(', ')}\n\nPlease correct the role IDs and try again:`,
                                    ephemeral: true
                                });
                            } else {
                                setup.data.roles = validRoles;
                                
                                // Save configuration
                                const ticketConfig = await TicketConfig.create({
                                    messageId: setup.data.messageId,
                                    guildId: interaction.guild.id,
                                    roles: JSON.stringify(setup.data.roles),
                                    parentId: setup.data.categoryId
                                });
                                
                                // Add reaction to the message
                                const ticketMessage = await interaction.channel.messages.fetch(setup.data.messageId);
                                await ticketMessage.react('🎫');
                                
                                await interaction.followUp({
                                    content: '✅ **Ticket system setup complete!**\n\nUsers can now react with 🎫 to the message to create tickets.',
                                    ephemeral: true
                                });
                                
                                // Clean up
                                ongoingSetups.delete(interaction.user.id);
                                collector.stop();
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Setup error:', error);
                    await interaction.followUp({
                        content: `❌ An error occurred: ${error.message}`,
                        ephemeral: true
                    });
                    ongoingSetups.delete(interaction.user.id);
                    collector.stop();
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.followUp({
                        content: '⏰ Setup timed out. Please run the command again if you want to continue.',
                        ephemeral: true
                    });
                }
                ongoingSetups.delete(interaction.user.id);
            });

        } catch (error) {
            console.error('Setup initialization error:', error);
            ongoingSetups.delete(interaction.user.id);
            await interaction.reply({
                content: '❌ An error occurred while starting the setup. Please try again.',
                ephemeral: true
            });
        }
    }
});

// Keep your existing messageReactionAdd event handler
client.on('messageReactionAdd', async (reaction, user) => {
    // ... (keep all your existing reaction handling code)
});

client.login(process.env.BOT_TOKEN);