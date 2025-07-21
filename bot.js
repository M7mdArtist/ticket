require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
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

client.once('ready', () => {
    console.log('Bot is online');
    db.authenticate()
    .then(() => {
        console.log('Connected to DB');
        Ticket.init(db);
        TicketConfig.init(db);
        Ticket.sync();
        TicketConfig.sync();
    }).catch((err) => console.log('Database connection error:', err));
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.type === 'DM') return;

    if (message.content.toLowerCase() === '?setup' && message.guild.ownerId === message.author.id) {
        try {
            const filter = (m) => m.author.id === message.author.id;
            message.channel.send("react with 🎫 to this message to open a ticket 🤙")
            
            await message.channel.send('Please enter the message ID for this ticket');
            const msgId = (await message.channel.awaitMessages({ filter, max: 1 })).first().content;
            
            const fetchMsg = await message.channel.messages.fetch(msgId);
            
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
                    
                const ticketConfig = await TicketConfig.create({
                    messageId: msgId,
                    guildId: message.guild.id,
                    roles: JSON.stringify(roles),
                    parentId: categoryChannel.id
                });
                console.log('ticketConfig');
                message.channel.send('Configuration saved to DB');
                await fetchMsg.react('🎫');
            } else throw new Error('Invalid fields');
        } catch (err) {
            console.error('Setup error:', err);
            message.channel.send(`Error during setup: ${err.message}`);
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    if (reaction.emoji.name === '🎫') {
        const ticketConfig = await TicketConfig.findOne({ where: { messageId: reaction.message.id } });
        if (ticketConfig) {
            await reaction.users.remove(user.id).catch(console.error)
            const findTicket = await Ticket.findOne({ where: {authorId: user.id, resolved: false } });
            if (findTicket) user.send('You already have a ticket');
            else {
                console.log('Creating a ticket');
                try {
                    await reaction.users.remove(user.id).catch(console.error)
                    const roleIdsString = ticketConfig.getDataValue('roles');
                    console.log(roleIdsString);
                    const roleIds = JSON.parse(roleIdsString);
                    console.log(roleIds);
                    const permissions = roleIds.map((id) => ({
                        allow: [PermissionsBitField.Flags.ViewChannel],
                        id
                    }));
                    const channel = await reaction.message.guild.channels.create({
                        name: 'ticket',
                        parent: ticketConfig.getDataValue('parentId'),
                        permissionOverwrites:[
                            {
                                deny: [PermissionsBitField.Flags.ViewChannel],
                                id: reaction.message.guild.id
                            },
                            {
                                allow: [PermissionsBitField.Flags.ViewChannel],
                                id: user.id
                            },
                            ...permissions
                        ]
                    });

                    const msg = await channel.send(`## 🎫This ticket was opened by ${user} \n > 💾 Your ticket will be saved. \n React with this emoji 🔒 to close the ticket.`);
                    await msg.react('🔒');
                    
                    const ticket = await Ticket.create({
                        authorId: user.id,
                        channelId: channel.id,
                        guildId: reaction.message.guild.id,
                        resolved: false,
                        closedMessageId: msg.id
                    });
                    
                    const ticketId = String(ticket.getDataValue('ticketId')).padStart(4, 0);
                    await channel.edit({ name: `ticket-${ticketId}` });

                } catch (err) {
                    console.log(err);
                }
            }
        } else {
            console.log('No ticket config found');
        }
    } else if (reaction.emoji.name === '🔒') {
        const ticket = await Ticket.findOne({ 
            where: { 
                channelId: reaction.message.channel.id,
                resolved: false 
            } 
        });
        
        if (ticket) {
            console.log('Closing ticket...');
            
            
            try {
                await reaction.message.channel.send('🔏 Closing ticket...')
                await reaction.message.channel.permissionOverwrites.edit(
                    ticket.authorId,
                    { ViewChannel: false }
                );
                
                await ticket.update({
                    resolved: true,
                    closedMessageId: reaction.message.id
                });
                
                await reaction.message.channel.send('Ticket closed successfully 🤙')
                console.log('Ticket closed successfully');
                
            } catch (err) {
                console.error('Error closing ticket:', err);
            }
        }
    }
});

client.login(process.env.BOT_TOKEN);