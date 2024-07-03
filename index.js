const { Client, GatewayIntentBits, REST, Routes, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const schedule = require('node-schedule');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const birthdayChannelId = '1196534223998304276';
const celebrationChannelId = '1200905048767594496';

client.once('ready', async () => {
    console.log(`${client.user.username} is online.`);
    await loadCommands();

    // Schedule birthday messages to be sent at 00:00 every day
    schedule.scheduleJob('00 0 * * *', () => {
        console.log('Scheduled job running at 00:00');
        checkAndSendBirthdayMessages();
    });
});

client.on('messageCreate', message => {
    if (message.channel.id === birthdayChannelId && !message.author.bot) {
        const datePattern = /^\d{1,2} (ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)$/i;
        if (datePattern.test(message.content.trim())) {
            const birthdayEntry = {
                date: message.content.trim().toLowerCase(),
                userId: message.author.id
            };

            let birthdays = [];
            if (fs.existsSync('birthdays.json')) {
                const fileContent = fs.readFileSync('birthdays.json');
                try {
                    birthdays = JSON.parse(fileContent);
                    if (!Array.isArray(birthdays)) {
                        birthdays = [];
                    }
                } catch (e) {
                    birthdays = [];
                }
            }
            birthdays.push(birthdayEntry);
            fs.writeFileSync('birthdays.json', JSON.stringify(birthdays, null, 2));
            message.channel.send('Doğum günün kaydedildi!');
            console.log('Doğum günü kaydedildi:', birthdayEntry);
        } else {
            message.channel.send('Lütfen "gün ay" formatında bir tarih girin. Örneğin: "7 haziran"');
        }
    }
});

async function loadBirthdaysFromHistory() {
    const channel = await client.channels.fetch(birthdayChannelId);
    if (!channel) return;

    let messages;
    let birthdays = [];
    if (fs.existsSync('birthdays.json')) {
        const fileContent = fs.readFileSync('birthdays.json');
        try {
            birthdays = JSON.parse(fileContent);
            if (!Array.isArray(birthdays)) {
                birthdays = [];
            }
        } catch (e) {
            birthdays = [];
        }
    }

    let lastMessageId;
    while (true) {
        if (lastMessageId) {
            messages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
        } else {
            messages = await channel.messages.fetch({ limit: 100 });
        }

        if (messages.size === 0) break;

        messages.forEach(message => {
            if (!message.author.bot) {
                const datePattern = /^\d{1,2} (ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)$/i;
                if (datePattern.test(message.content.trim())) {
                    const birthdayEntry = {
                        date: message.content.trim().toLowerCase(),
                        userId: message.author.id
                    };
                    birthdays.push(birthdayEntry);
                    console.log('Geçmiş doğum günü bulundu:', birthdayEntry);
                }
            }
        });

        lastMessageId = messages.last().id;
    }

    fs.writeFileSync('birthdays.json', JSON.stringify(birthdays, null, 2));
    console.log('Doğum günleri geçmişten yüklendi.');
}

function checkAndSendBirthdayMessages() {
    console.log('Checking for birthdays...');
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('tr-TR', { month: 'long' }).toLowerCase();

    const todayString = `${day} ${month}`;
    console.log(`Today's date string: ${todayString}`);
    sendBirthdayMessages(todayString);
}

function sendBirthdayMessages(dateString) {
    if (fs.existsSync('birthdays.json')) {
        const fileContent = fs.readFileSync('birthdays.json');
        try {
            const birthdays = JSON.parse(fileContent);
            console.log('Loaded birthdays:', birthdays);
            if (Array.isArray(birthdays)) {
                let birthdayFound = false;
                birthdays.forEach(birthday => {
                    if (birthday.date === dateString) {
                        birthdayFound = true;
                        console.log(`Found birthday for user ID: ${birthday.userId}`);
                        const guilds = client.guilds.cache.map(guild => guild);
                        guilds.forEach(guild => {
                            console.log(`Checking guild: ${guild.name}`);
                            const celebrationChannel = guild.channels.cache.get(celebrationChannelId);
                            if (celebrationChannel) {
                                const permissions = celebrationChannel.permissionsFor(client.user);
                                if (permissions.has(PermissionsBitField.Flags.SendMessages)) {
                                    celebrationChannel.send(`<@${birthday.userId}> Doğum günün kutlu olsun! 🎉`)
                                        .then(() => {
                                            console.log(`Sent birthday message to user ID: ${birthday.userId} in channel: ${celebrationChannelId}`);
                                        })
                                        .catch(error => {
                                            console.error(`Failed to send message: ${error}`);
                                        });
                                } else {
                                    console.log(`No permission to send messages in channel: ${celebrationChannelId}`);
                                }
                            } else {
                                console.log(`Celebration channel not found in guild: ${guild.name}`);
                            }
                        });
                    }
                });
                if (!birthdayFound) {
                    console.log(`No birthday found for date: ${dateString}`);
                }
            } else {
                console.log('Birthdays data is not an array.');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    } else {
        console.log('Birthdays file not found.');
    }
}

client.login(config.token);

async function loadCommands() {
    const commands = [
        {
            name: 'help',
            description: 'Botun yardım komutlarını gösterir.'
        },
        {
            name: 'checkbirthdays',
            description: 'Doğum günlerini hemen kontrol eder.'
        },
        {
            name: 'testbirthdays',
            description: 'Doğum günü mesajlarını manuel olarak test eder.'
        },
        {
            name: 'syncbirthdays',
            description: 'Geçmiş doğum günü mesajlarını kontrol edip kaydeder.'
        },
        {
            name: 'birthday',
            description: 'Belirtilen tarihte doğum günü olanların doğum gününü kutlar.',
            options: [
                {
                    name: 'date',
                    type: 3, // STRING type
                    description: 'Kontrol edilecek tarih (gün ay formatında, örneğin: 7 haziran)',
                    required: true
                }
            ]
        },
        {
            name: 'birthdaymessage',
            description: 'Belirtilen kullanıcıya doğum günü mesajı gönderir.',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'Doğum günü mesajı gönderilecek kullanıcı',
                    required: true
                }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(config.token);
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'help') {
        await interaction.reply('Merhaba! Bu botun özellikleri:\n1. Doğum günü kaydı için "gün ay" formatında yazın.\n2. Her gün doğum günlerini kontrol eder ve doğum günü olanlara mesaj gönderir.');
    }

    if (commandName === 'checkbirthdays') {
        checkAndSendBirthdayMessages();
        await interaction.reply('Doğum günleri kontrol edildi.');
    }

    if (commandName === 'testbirthdays') {
        checkAndSendBirthdayMessages();
        await interaction.reply('Doğum günü mesajları manuel olarak test edildi.');
    }

    if (commandName === 'syncbirthdays') {
        await loadBirthdaysFromHistory();
        await interaction.reply('Geçmiş doğum günü mesajları kontrol edildi ve kaydedildi.');
    }

    if (commandName === 'birthday') {
        const date = interaction.options.getString('date');
        const datePattern = /^\d{1,2} (ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)$/i;
        if (datePattern.test(date.trim())) {
            const dateString = date.trim().toLowerCase();
            sendBirthdayMessages(dateString);
            await interaction.reply(`Doğum günü mesajları ${dateString} tarihi için gönderildi.`);
        } else {
            await interaction.reply('Lütfen "gün ay" formatında bir tarih girin. Örneğin: "7 haziran"');
        }
    }

    if (commandName === 'birthdaymessage') {
        const user = interaction.options.getUser('user');
        const guild = interaction.guild;
        const celebrationChannel = guild.channels.cache.get(celebrationChannelId);

        if (celebrationChannel) {
            const permissions = celebrationChannel.permissionsFor(client.user);
            if (permissions.has(PermissionsBitField.Flags.SendMessages)) {
                celebrationChannel.send(`<@${user.id}> Doğum günün kutlu olsun! 🎉 @everyone`)
                    .then(() => {
                        console.log(`Sent birthday message to user ID: ${user.id} in channel: ${celebrationChannelId}`);
                        interaction.reply(`Doğum günü mesajı ${user.username} için gönderildi.`);
                    })
                    .catch(error => {
                        console.error(`Failed to send message: ${error}`);
                        interaction.reply(`Mesaj gönderilemedi: ${error.message}`);
                    });
            } else {
                console.log(`No permission to send messages in channel: ${celebrationChannelId}`);
                interaction.reply('Bu kanalda mesaj gönderme iznim yok.');
            }
        } else {
            console.log(`Celebration channel not found in guild: ${guild.name}`);
            interaction.reply('Kutlama kanalı bulunamadı.');
        }
    }
});






























