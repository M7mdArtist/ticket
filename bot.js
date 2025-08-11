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
		.addChannelOption((option) =>
			option
				.setName('category')
				.setDescription('The category ID for tickets')
				.addChannelTypes(ChannelType.GuildCategory)
				.setRequired(true)
		)
		.addStringOption((option) =>
			option.setName('roles').setDescription('Comma-separated role IDs that have access to tickets').setRequired(true)
		),
	new SlashCommandBuilder().setName('delete').setDescription('Delete all closed tickets'),
	new SlashCommandBuilder().setName('claim').setDescription('Claim the ticket'),
	new SlashCommandBuilder()
		.setName('create-logs')
		.setDescription('Creates a logs channel')
		.addChannelOption((option) =>
			option
				.setName('category')
				.setDescription('Chose the category to create the logs channel')
				.addChannelTypes(ChannelType.GuildCategory)
				.setRequired(true)
		),
	new SlashCommandBuilder()
		.setName('set-logs')
		.setDescription('Start the logs in an existing channel')
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription('Chose the channel to start the logs')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		),
	new SlashCommandBuilder().setName('stop-logs').setDescription('stop logging the tickets'),
].map((command) => command.toJSON());

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
		.catch((err) => console.log('Database connection error:', err));
});

async function deleteClosedTickets(guild, categoryId, searchText) {
	try {
		const category = guild.channels.cache.get(categoryId);
		if (!category || category.type !== ChannelType.GuildCategory) {
			return console.log('Invalid category ID or not a category channel');
		}
		const channels = category.children.cache.filter(
			(channel) => channel.type === ChannelType.GuildText && channel.name.includes(searchText)
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
client.on('interactionCreate', async (interaction) => {
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
					...roleObjects.map((role) => ({
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
				logs: false,
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
			await interaction.deferReply({ ephemeral: true });
			const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
			if (!ticketConfig) {
				return interaction.editReply({ content: 'Ticket system not configured for this server.' });
			}

			if (interaction.channel.id !== ticketConfig.getDataValue('deleteTicketsChannelId')) {
				return interaction.editReply({
					content: 'This command can only be used in the delete-closed-tickets channel.',
				});
			}

			await interaction.editReply({
				content: '⏳ Deleting closed tickets...',
				embeds: [],
			});

			const deleteCount = await deleteClosedTickets(interaction.guild, ticketConfig.getDataValue('parentId'), 'closed');
			if (deleteCount === 0) {
				await interaction.editReply({ content: 'There are no closed tickets to delete.', ephemeral: true });
			} else {
				const date = new Date();
				const unixNow = Math.floor(date.getTime() / 1000);

				const deleteEmbed = new EmbedBuilder()
					.setTitle('Delete Info')
					.addFields(
						{ name: 'deleted:', value: `${deleteCount} tickets`, inline: true },
						{ name: 'used by:', value: `${interaction.user}`, inline: true },
						{ name: 'date:', value: `<t:${unixNow}:D>`, inline: true }
					);

				interaction.editReply({
					content: 'All closed tickets deleted successfully',
				});
				interaction.channel.send({
					embeds: [deleteEmbed],
				});
			}
		} catch (error) {
			console.error('Error in delete command:', error);
			await interaction.editReply({ content: 'An error occurred while deleting tickets.', ephemeral: true });
		}
	}

	if (interaction.commandName === 'claim') {
		try {
			// Find ticket for the current channel
			const ticket = await Ticket.findOne({
				where: {
					channelId: interaction.channel.id,
					resolved: false,
					claimed: false,
				},
			});

			const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
			const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
			const isAllowed = interaction.member.roles.cache.some((role) => allowedRoles.includes(role.id));

			if (!isAllowed) {
				interaction.reply({
					content: `you don't have permission to use this command`,
					ephemeral: true,
				});
			} else {
				if (!ticket) {
					return interaction.reply({
						content: 'This is not a valid ticket channel or the ticket is already closed/claimed',
						ephemeral: true,
					});
				}

				let ticketMsg;
				const channel = interaction.channel;
				const messages = await channel.messages.fetch({ limit: 10 });
				ticketMsg = messages.find((m) => m.content.includes('🎫 This ticket was opened by'));

				if (!ticketMsg) {
					return interaction.reply({
						content: 'Could not find the ticket message.',
						ephemeral: true,
					});
				}

				await ticketMsg.edit(
					`## 🎫 This ticket was opened by <@${ticket.authorId}> \n > 💾 Your ticket will be saved. \n React with this emoji 🔏 to close the ticket.\n Ticket claimed by: ${interaction.user}`
				);

				await ticket.update({
					claimed: true,
					claimerId: interaction.user.id,
				});

				const logMsgId = ticket.getDataValue('logId');

				if (logMsgId) {
					try {
						const logsChannel = await interaction.guild.channels.fetch(ticketConfig.getDataValue('logsChannelId'));
						const logMsg = await logsChannel.messages.fetch(logMsgId);
						const embed = logMsg.embeds[0];

						const newEmbed = new EmbedBuilder().setTitle(embed.title);

						embed.fields.forEach((field) => {
							if (field.name === 'claimed by:') {
								newEmbed.addFields({
									name: 'claimed by:',
									value: `<@${interaction.user.id}>`,
									inline: field.inline,
								});
							} else {
								newEmbed.addFields(field);
							}
						});

						await logMsg.edit({ embeds: [newEmbed] });
					} catch (error) {
						console.error('error while editing the embed "claim"');
					}
				}

				console.log(ticket);

				await interaction.reply({
					content: 'You have claimed this ticket!',
					ephemeral: true,
				});
			}
		} catch (error) {
			console.error('Error claiming ticket:', error);
			if (!interaction.replied) {
				await interaction.reply({
					content: 'An error occurred while claiming the ticket.',
					ephemeral: true,
				});
			}
		}
	}

	if (interaction.commandName === 'create-logs') {
		try {
			const ticketConfig = await TicketConfig.findOne({ where: { logs: false, guildId: interaction.guild.id } });
			const categoryId = interaction.options.getChannel('category').id;

			if (!ticketConfig) {
				interaction.reply({
					content: 'there is already a logs or system is not configured',
					ephemeral: true,
				});
				return;
			}

			const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
			const isAllowed = interaction.member.roles.cache.some((role) => allowedRoles.includes(role.id));

			if (isAllowed) {
				if (ticketConfig) {
					const logsChannel = await interaction.guild.channels.create({
						name: 'ticket-logs',
						type: ChannelType.GuildText,
						parent: categoryId,
						permissionOverwrites: [
							{
								id: interaction.guild.id,
								deny: [PermissionsBitField.Flags.ViewChannel],
							},
						],
					});

					await ticketConfig.update({
						logs: true,
						logsChannelId: logsChannel.id,
					});

					interaction.reply({
						content: `Created a logs channel <#${logsChannel.id}>`,
						ephemeral: true,
					});
				}
			} else {
				interaction.reply({
					content: 'you are not allowed to use this command',
					ephemeral: true,
				});
			}
		} catch (error) {
			console.error('error while creating logs channel', error);
		}
	}

	if (interaction.commandName === 'set-logs') {
		try {
			const ticketConfig = await TicketConfig.findOne({ where: { logs: false, guildId: interaction.guild.id } });
			const channelId = interaction.options.getChannel('channel').id;

			if (!ticketConfig) {
				interaction.reply({
					content: 'there is already a logs or system is not configured',
					ephemeral: true,
				});
			}

			const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
			const isAllowed = interaction.member.roles.cache.some((role) => allowedRoles.includes(role.id));

			if (isAllowed) {
				if (ticketConfig) {
					await ticketConfig.update({
						logs: true,
						logsChannelId: channelId,
					});
					interaction.reply({
						content: `logs channel set to <#${channelId}>`,
						ephemeral: true,
					});
				}
			} else {
				interaction.reply({
					content: `you don't have permission to use this command`,
					ephemeral: true,
				});
			}
		} catch (error) {}
	}

	if (interaction.commandName === 'stop-logs') {
		try {
			const ticketConfig = await TicketConfig.findOne({ where: { logs: true, guildId: interaction.guild.id } });

			if (!ticketConfig) {
				interaction.reply({
					content: 'there is no active logs',
					ephemeral: true,
				});
			}

			const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
			const isAllowed = interaction.member.roles.cache.some((role) => allowedRoles.includes(role.id));

			if (isAllowed) {
				if (ticketConfig) {
					await ticketConfig.update({
						logs: false,
						logsChannelId: null,
					});
					console.log(ticketConfig);
					interaction.reply({
						content: 'logs stopped',
						ephemeral: true,
					});
				}
			} else {
				interaction.reply({
					content: `you don't have permission to use this command`,
					ephemeral: true,
				});
			}
		} catch (error) {
			console.error('error while stopping logs', error);
		}
	}
});

client.on('messageCreate', async (message) => {
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
					const permissions = roleIds.map((id) => ({
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

					// Save the ticket message to userTickets for global access
					const ticketMsg = await channel.send(
						`## 🎫 This ticket was opened by ${user} \n > 💾 Your ticket will be saved. \n React with this emoji 🔏 to close the ticket.\n Ticket claimed by: not claimed`
					);
					await ticketMsg.react('🔏');

					let ticket = await Ticket.create({
						authorId: user.id,
						channelId: channel.id,
						guildId: reaction.message.guild.id,
						resolved: false,
						closedMessageId: ticketMsg.id,
						claimed: false,
					});

					const ticketId = String(ticket.getDataValue('ticketId')).padStart(4, '0');
					await channel.edit({ name: `ticket-${ticketId}` });

					const logsChannelId = ticketConfig.getDataValue('logsChannelId');
					if (logsChannelId) {
						const logsChannel = await reaction.message.guild.channels.fetch(logsChannelId);

						let claimStat;
						if (ticket.getDataValue('claimed') === false) {
							claimStat = 'not claimed';
						} else {
							claimStat = `<@${ticket.getDataValue('claimerId')}>`;
						}

						let closeStat;
						if (ticket.getDataValue('resolved') === false) {
							closeStat = 'Opened ✅';
						} else {
							closeStat = 'Closed 🔏';
						}

						const logEmbed = new EmbedBuilder()
							.setTitle(`<#${channel.id}>`)
							.addFields(
								{ name: 'opened by:', value: `<@${user.id}>`, inline: true },
								{ name: 'claimed by:', value: claimStat, inline: true },
								{ name: 'status:', value: closeStat, inline: true }
							);

						const log = await logsChannel.send({ embeds: [logEmbed] });
						ticket.update({
							logId: log.id,
						});
						console.log(ticket);
					} else {
						console.log('there is no log configure');
					}
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
			const ticketConfig = await TicketConfig.findOne({
				where: { guildId: reaction.message.guild.id },
			});

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

			collector.on('collect', async (reaction) => {
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

						// Update the log embed
						const logMsgId = ticket.getDataValue('logId');
						if (logMsgId && ticketConfig) {
							try {
								const logsChannel = await reaction.message.guild.channels.fetch(
									ticketConfig.getDataValue('logsChannelId')
								);
								const logMsg = await logsChannel.messages.fetch(logMsgId);
								const embed = logMsg.embeds[0];

								// Create new embed with updated status
								const newEmbed = new EmbedBuilder().setTitle(embed.title).setColor(embed.color || null);

								// Update status field while preserving others
								embed.fields.forEach((field) => {
									if (field.name === 'status:') {
										newEmbed.addFields({
											name: 'status:',
											value: 'Closed 🔏',
											inline: field.inline,
										});
									} else {
										newEmbed.addFields(field);
									}
								});

								await logMsg.edit({ embeds: [newEmbed] });
							} catch (error) {
								console.error('Error updating log embed:', error);
							}
						}

						await reaction.message.channel.send('Ticket closed successfully 🤙');
						console.log('Ticket closed successfully');
					} catch (err) {
						console.error('Error closing ticket:', err);
					}
				}
			});

			collector.on('end', async (collected) => {
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
