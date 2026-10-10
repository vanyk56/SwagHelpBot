import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  MessageFlags,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ChannelType,
} from 'discord.js';
import 'dotenv/config';

const TOKEN = process.env.TOKEN?.trim();
const ROLE_ID = process.env.ROLE_ID?.trim();
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID?.trim() || null;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID?.trim() || null;
const BRAND_COLOR = parseInt((process.env.BRAND_COLOR || 'D99A8C').replace('#', ''), 16);
const MESSAGE_CONTENT = process.env.ENABLE_MESSAGE_CONTENT === 'true';

if (!TOKEN) {
  console.error('Ошибка: не задан TOKEN. Добавьте переменную TOKEN на Railway (вкладка Variables) или в файл .env.');
  process.exit(1);
}
if (!/^[A-Za-z0-9_.-]{50,}$/.test(TOKEN)) {
  console.error(
    'Ошибка: TOKEN выглядит неверным. Скопируйте токен заново из Discord Developer Portal (Bot → Reset Token) — без кавычек и лишних символов.'
  );
  process.exit(1);
}
if (!ROLE_ID) {
  console.error('Ошибка: не задан ROLE_ID. Добавьте переменную ROLE_ID на Railway (вкладка Variables) или в файл .env.');
  process.exit(1);
}

const TICKET_TOPICS = [
  { value: 'complaint', label: 'Жалоба на игрока', description: 'Нарушение правил другим игроком', emoji: '🚨', slug: 'жалоба' },
  { value: 'question', label: 'Вопрос по серверу', description: 'Вайпы, магазины, игровой процесс', emoji: '❓', slug: 'вопрос' },
  { value: 'unban', label: 'Разбан / обжалование', description: 'Если вы получили блокировку', emoji: '🔓', slug: 'разбан' },
  { value: 'idea', label: 'Предложение', description: 'Идеи по улучшению сервера', emoji: '💡', slug: 'идея' },
  { value: 'other', label: 'Другое', description: 'Любой другой вопрос', emoji: '✉️', slug: 'тикет' },
];

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
];
if (MESSAGE_CONTENT) intents.push(GatewayIntentBits.MessageContent);

const client = new Client({ intents });

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Опубликовать панель тикетов в этом канале и закрепить её')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
];

const acknowledgedTickets = new Set();

function parseTicketTopic(topic) {
  if (!topic || !topic.startsWith('ticket:')) return null;
  const userId = topic.split('|')[0].replace('ticket:', '').trim();
  return userId ? { userId } : null;
}

function ticketsPanel() {
  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '# 🎫 Поддержка сервера',
          '### Написать администрации напрямую',
          '> Выберите причину обращения — для вас создастся **приватный канал**, в котором вас услышат только вы и администрация.',
          '',
          '-# 📩 Один игрок — один открытый тикет · Ответ обычно в течение дня',
        ].join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_create')
          .setPlaceholder('📩 Выберите причину обращения…')
          .addOptions(
            TICKET_TOPICS.map((t) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(t.label)
                .setValue(t.value)
                .setDescription(t.description)
                .setEmoji(t.emoji)
            )
          )
      )
    );
}

function ticketWelcomePanel(member, topic) {
  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `# 🎫 Тикет: ${topic.label}`,
          `> Открыл: ${member}`,
          '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
          '### Что дальше?',
          '- Опишите проблему **одним сообщением** — можно прикрепить скриншоты и видео',
          '- Администрация ответит прямо в этом канале — следите за уведомлениями',
          '- Этот канал видите **только вы и администрация**',
          '',
          '-# Когда вопрос решён — нажмите кнопку ниже',
        ].join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Закрыть тикет')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      )
    );
}

function ticketClosedPanel() {
  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '# 🔒 Тикет закрыт',
          '> Канал и история сообщений будут удалены через 10 секунд.',
          '-# Спасибо за обращение! Если вопрос возникнет снова — создайте новый тикет.',
        ].join('\n')
      )
    );
}

async function canManageRole(guild) {
  const role = await guild.roles.fetch(ROLE_ID).catch(() => null);
  if (!role) {
    console.error(`[${guild.name}] Роль ${ROLE_ID} на этом сервере не найдена.`);
    return false;
  }
  const me = guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.error(
      `[${guild.name}] У бота нет права «Управлять ролями». Пригласите бота заново: Discord Developer Portal → OAuth2 → URL Generator → галочка bot → галочка Manage Roles.`
    );
    return false;
  }
  if (role.position >= me.roles.highest.position) {
    console.error(
      `[${guild.name}] Роль бота («${me.roles.highest.name}») стоит НЕ выше роли «${role.name}». Настройки сервера → Роли → перетащите роль бота выше роли «${role.name}».`
    );
    return false;
  }
  return true;
}

async function checkTicketSetup(guild) {
  const me = guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    console.error(
      `[${guild.name}] У бота нет права «Управлять каналами» — тикеты создать не получится. Пригласите бота заново с правами: Управление ролями, Управление каналами, Управление сообщениями.`
    );
  }
  if (SUPPORT_ROLE_ID) {
    const role = await guild.roles.fetch(SUPPORT_ROLE_ID).catch(() => null);
    if (!role) {
      console.error(`[${guild.name}] SUPPORT_ROLE_ID (${SUPPORT_ROLE_ID}) не найден на этом сервере — администрация не увидит тикеты.`);
    } else {
      console.log(`[${guild.name}] Роль поддержки в тикетах: «${role.name}».`);
    }
  } else {
    console.warn(`[${guild.name}] SUPPORT_ROLE_ID не задан — тикеты будут видеть только участники с правом «Администратор».`);
  }
  if (TICKET_CATEGORY_ID) {
    const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
    if (!category) console.error(`[${guild.name}] Категория ${TICKET_CATEGORY_ID} не найдена — тикеты создадутся без категории.`);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Бот запущен как ${c.user.tag}`);
  if (!MESSAGE_CONTENT) {
    console.log('Чтение текста сообщений выключено (ENABLE_MESSAGE_CONTENT=false) — бот видит текст только при теге/ответе.');
  }

  for (const guild of c.guilds.cache.values()) {
    try {
      await guild.commands.set(COMMANDS);
      console.log(`[${guild.name}] Команда /setup-tickets зарегистрирована.`);
    } catch (err) {
      console.error(`[${guild.name}] Не удалось зарегистрировать команды: ${err.message}`);
    }
    await checkTicketSetup(guild);
    if (!(await canManageRole(guild))) continue;

    const members = await guild.members.fetch();
    let fixed = 0;
    for (const member of members.values()) {
      if (member.user.bot || member.premiumSince || member.roles.cache.has(ROLE_ID)) continue;
      try {
        await member.roles.add(ROLE_ID, 'Автовыдача роли новичкам');
        fixed++;
      } catch (err) {
        console.error(`[${guild.name}] Не удалось выдать роль ${member.user.tag}: ${err.message}`);
      }
    }
    console.log(`[${guild.name}] Проверка роли пройдена. Пропущенным выдана роль: ${fixed}. Жду новых участников.`);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;
  if (member.premiumSince) {
    console.log(`${member.user.tag} — бустер, роль не выдаём.`);
    return;
  }

  try {
    await member.roles.add(ROLE_ID, 'Автовыдача роли новичкам');
    console.log(`Выдана роль «игрок» участнику ${member.user.tag}`);
  } catch (err) {
    console.error(`Не удалось выдать роль участнику ${member.user.tag}: ${err.message}`);
  }
});

async function handleSetupTickets(i) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const message = await i.channel.send({ components: [ticketsPanel()], flags: MessageFlags.IsComponentsV2 });
  let pinned = true;
  try {
    await message.pin();
  } catch {
    pinned = false;
  }
  await i.editReply({
    content: pinned
      ? 'Панель тикетов опубликована и закреплена в этом канале.'
      : 'Панель опубликована, но закрепить не удалось — боту не хватает права «Управлять сообщениями».',
  });
}

async function handleTicketCreate(i) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const topic = TICKET_TOPICS.find((t) => t.value === i.values[0]) || TICKET_TOPICS.at(-1);

  let channels;
  try {
    channels = await i.guild.channels.fetch();
  } catch {
    channels = i.guild.channels.cache;
  }
  const existing = channels.find((c) => (c.topic || '').startsWith(`ticket:${i.user.id}`));
  if (existing) {
    await i.editReply({ content: `У вас уже есть открытый тикет: ${existing}` });
    return;
  }

  const userName = i.user.username.toLowerCase().replace(/[^a-z0-9а-яё_-]/g, '').slice(0, 20) || i.user.id.slice(-6);
  const overwrites = [
    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: i.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];
  if (SUPPORT_ROLE_ID) {
    overwrites.push({
      id: SUPPORT_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `ticket-${topic.slug}-${userName}`.slice(0, 100),
      type: ChannelType.GuildText,
      topic: `ticket:${i.user.id} | ${topic.label}`,
      parent: TICKET_CATEGORY_ID || undefined,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    if (err.code === 50013 || err.code === '50013') {
      await i.editReply({
        content:
          'Не хватает прав на создание канала. Пригласите бота заново с правом «Управление каналами» (Discord Developer Portal → OAuth2 → URL Generator → bot → Manage Channels).',
      });
    } else {
      throw err;
    }
    return;
  }

  await channel.send({ components: [ticketWelcomePanel(i.member, topic)], flags: MessageFlags.IsComponentsV2 });
  console.log(`[${i.guild.name}] Тикет создан: ${channel.name} (${i.user.tag})`);
  await i.editReply({ content: `Тикет создан: ${channel} — опишите вашу проблему в этом канале.` });
}

function parseTicketChannel(i) {
  return parseTicketTopic(i.channel?.topic);
}

async function handleTicketClose(i) {
  const meta = parseTicketChannel(i);
  if (!meta) {
    await i.reply({ content: 'Это не тикет-канал.', flags: MessageFlags.Ephemeral });
    return;
  }
  const isOwner = i.user.id === meta.userId;
  const isStaff =
    i.member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    (SUPPORT_ROLE_ID && i.member.roles.cache.has(SUPPORT_ROLE_ID));
  if (!isOwner && !isStaff) {
    await i.reply({ content: 'Закрыть тикет может только его автор или администрация.', flags: MessageFlags.Ephemeral });
    return;
  }
  await i.reply({
    content: 'Закрыть тикет? Канал и вся история сообщений будут удалены.',
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Да, закрыть').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleTicketCloseConfirm(i) {
  await i.update({ content: 'Закрываю тикет…', components: [] });
  await i.channel.send({ components: [ticketClosedPanel()], flags: MessageFlags.IsComponentsV2 });
  acknowledgedTickets.delete(i.channelId);
  setTimeout(() => {
    i.channel.delete('Тикет закрыт').catch(() => {});
  }, 10_000);
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand() && i.commandName === 'setup-tickets') {
      await handleSetupTickets(i);
    } else if (i.isStringSelectMenu() && i.customId === 'ticket_create') {
      await handleTicketCreate(i);
    } else if (i.isButton() && i.customId === 'ticket_close') {
      await handleTicketClose(i);
    } else if (i.isButton() && i.customId === 'ticket_close_confirm') {
      await handleTicketCloseConfirm(i);
    } else if (i.isButton() && i.customId === 'ticket_close_cancel') {
      await i.update({ content: 'Закрытие отменено.', components: [] });
    }
  } catch (err) {
    console.error(`Ошибка взаимодействия (${i.commandName || i.customId}):`, err.message);
    const fallback = { content: 'Произошла ошибка. Попробуйте ещё раз или сообщите администрации.' };
    if (i.deferred || i.replied) {
      await i.editReply(fallback).catch(() => {});
    } else {
      await i.reply({ ...fallback, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (msg) => {
  if (!msg.inGuild() || msg.author.bot) return;
  const meta = parseTicketTopic(msg.channel.topic);
  if (!meta || msg.author.id !== meta.userId || acknowledgedTickets.has(msg.channelId)) return;
  acknowledgedTickets.add(msg.channelId);
  await msg
    .reply({ content: '✅ Сообщение получено — администрация ответит здесь в ближайшее время.' })
    .catch(() => {});
});

client.login(TOKEN);
