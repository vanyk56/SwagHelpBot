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

const DEFAULT_RULES = [
  '- Вайп карты — каждую пятницу в 16:00 МСК, блюпринты сохраняются.',
  '- Максимальный размер команды — 4 игрока.',
  '- Запрещены: читы, скрипты, макросы, багоюз, обход блокировки, реклама других серверов, токсичность и оскорбления.',
  '- Бан за читы и багоюз — перманентный, обжалованию не подлежит.',
  '- Бан за токсичность — от 1 дня до перманентного, на усмотрение модератора.',
  '- Покупки в магазине не возвращаются и не компенсируются.',
  '- Потери от багов игры не компенсируются без видео-доказательств.',
  '- Если ответа на вопрос нет в этих правилах — обращение передаётся администрации.',
].join('\n');

const TOKEN = process.env.TOKEN?.trim();
const ROLE_ID = process.env.ROLE_ID?.trim();
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID?.trim() || null;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID?.trim() || null;
const BRAND_COLOR = parseInt((process.env.BRAND_COLOR || 'D99A8C').replace('#', ''), 16);
const MESSAGE_CONTENT = process.env.ENABLE_MESSAGE_CONTENT === 'true';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim() || null;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-haiku-5.5';
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID?.trim() || process.env.SUPPORT_ROLE_ID?.trim() || null;
const SERVER_NAME = process.env.SERVER_NAME?.trim() || 'Rust-сервер';
const AI_RULES = (process.env.AI_RULES?.trim() || DEFAULT_RULES).replace(/\\n/g, '\n');
const AI_ENABLED = Boolean(OPENROUTER_API_KEY);

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
if (AI_ENABLED && !MESSAGE_CONTENT) {
  console.error(
    'ВНИМАНИЕ: задан OPENROUTER_API_KEY, но ENABLE_MESSAGE_CONTENT != true — ИИ не сможет читать сообщения. Включите Message Content Intent в Discord Developer Portal и поставьте ENABLE_MESSAGE_CONTENT=true.'
  );
}

const TICKET_TOPICS = [
  { value: 'question', label: 'Вопрос по серверу', description: 'Вайпы, магазины, игровой процесс', emoji: '❓', slug: 'вопрос' },
  { value: 'unban', label: 'Разбан / обжалование', description: 'Если вы получили блокировку', emoji: '🔓', slug: 'разбан' },
  { value: 'staff', label: 'Заявка в Staff', description: 'Хочу помогать развитию сервера', emoji: '📝', slug: 'staff' },
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
  new SlashCommandBuilder()
    .setName('ai-off')
    .setDescription('Отключить ИИ в этом тикете — отвечает и закрывает только администрация')
    .toJSON(),
];

const acknowledgedTickets = new Set();
const closeTimers = new Map();
const aiTimers = new Map();
const aiBusy = new Set();
const humanTakeover = new Set();

function parseTicketTopic(topic) {
  if (!topic || !topic.startsWith('ticket:')) return null;
  const parts = topic.split('|');
  const userId = parts[0].replace('ticket:', '').trim();
  if (!userId) return null;
  return { userId, value: parts[1]?.trim() || null };
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
  const lines = [
    `# 🎫 Тикет: ${topic.label}`,
    `> Открыл: ${member}`,
    '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
  ];

  if (topic.value === 'unban') {
    lines.push(
      '### 🔓 Обжалование блокировки',
      '',
      'Чтобы мы могли рассмотреть обжалование, укажите в сообщении:',
      '',
      '🆔 **Ваш Steam ID** *(SteamID64, например 76561198…)*',
      '⛔ **Причину бана** — как её написал модератор',
      '📅 **Когда был выдан бан** — хотя бы примерно',
      '💬 **Ваши пояснения** — почему, по вашему мнению, бан стоит снять',
      '',
      '> **Без Steam ID обращение не будет рассмотрено.**',
      '',
      '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
      'Прикрепите скриншоты или видео, если они есть — это ускорит разбирательство.',
    );
  } else if (topic.value === 'staff') {
    lines.push(
      '### 📝 Заявка в Staff',
      '',
      'Заполните анкету честно и развёрнуто — по одной строке на пункт:',
      '',
      '💼 **Желаемая должность** — выберите одну:',
      '- 🗺 **Мапер** — постройки, монументы, проработка карты',
      '- 🔨 **Модератор** — порядок в игре, читеры, споры',
      '- 🎫 **Модератор тикетов** — поддержка игроков, быстрые ответы',
      '- 💻 **Кодер** — плагины, скрипты, серверная часть',
      '- 🎬 **Медиа** — клипы, обложки, оформление Discord и сервера',
      '- 📣 **SMM** — продвижение, соцсети, привлечение игроков',
      '-# Не нашли подходящую? Предложите свою роль — рассмотрим.',
      '🆔 **Ваш Steam ID** *(SteamID64, например 76561198…)*',
      '📜 **Ваш опыт** — что вы уже делали, на каких серверах, есть ли работы',
      '⭐ **Почему именно вы?** — чем вы выделяетесь среди других кандидатов',
      '🎂 **Ваш возраст**',
      '⏱ **Сколько времени готовы уделять серверу** — в среднем в день или в неделю',
      '',
      '> **Заявки без Steam ID и описания опыта не рассматриваются.**',
      '',
      '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
      'Если у вас есть портфолио, скриншоты работ или ссылки — прикрепите их, это серьёзно повышает шансы.',
      '-# Ответ по заявке приходит лично в этот тикет. Если отказ — не расстраивайтесь, заявки пересматриваются при расширении штата.',
    );
  } else {
    lines.push(
      '### Что дальше?',
      '- Опишите проблему **одним сообщением** — можно прикрепить скриншоты и видео',
      '- Администрация ответит прямо в этом канале — следите за уведомлениями',
      '- Этот канал видите **только вы и администрация**'
    );
  }

  lines.push('', '-# Когда вопрос решён — нажмите кнопку ниже');

  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
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

function ticketClosedPanel(seconds = 10) {
  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '# 🔒 Тикет закрыт',
          `> Канал и история сообщений будут удалены через ${seconds} секунд.`,
          '-# Спасибо за обращение! Если вопрос возникнет снова — создайте новый тикет.',
        ].join('\n')
      )
    );
}

function scheduleChannelClose(channel, delayMs) {
  if (closeTimers.has(channel.id)) clearTimeout(closeTimers.get(channel.id));
  closeTimers.set(
    channel.id,
    setTimeout(() => {
      closeTimers.delete(channel.id);
      channel.delete('Тикет закрыт').catch(() => {});
    }, delayMs)
  );
}

function buildSystemPrompt(topicLabel) {
  return [
    `Ты — ИИ-модератор поддержки Discord-сервера Rust «${SERVER_NAME}». Ты работаешь внутри приватного тикет-канала, где игрок общается с администрацией. Тема тикета: «${topicLabel}».`,
    '',
    '## Задача',
    '- Отвечать игроку на русском, вежливо и по делу, строго по правилам сервера ниже.',
    '- Выносить вердикты по обращениям, когда ответ прямо следует из правил.',
    '- Передавать администрации всё, что требует живого человека.',
    '',
    '## Правила сервера',
    AI_RULES,
    '',
    '## Как принимать решение',
    '1. Ответ прямо следует из правил, и вопрос исчерпан → action "close": напиши игроку финальный ответ, тикет закроется автоматически.',
    '2. Нужно уточнение от игрока → action "reply": задай один конкретный вопрос.',
    '3. Ответа нет в правилах, ситуация спорная, нужна проверка модератором, это заявка в Staff или суть вопроса видна только во вложении → action "escalate".',
    '',
    '## Ограничения',
    '- Ничего не выдумывай: нет данных в правилах — передавай администрации, а не сочиняй.',
    '- Вложения (скриншоты, видео) ты не видишь: если суть вопроса ясна только из вложения — передавай администрации.',
    '- Игрок пишет на русском — отвечай ему на русском.',
    '',
    '## Формат ответа',
    'Отвечай строго валидным JSON без какого-либо текста вокруг:',
    '{"action":"reply|close|escalate","reply":"ответ игроку на русском","reason":"краткое обоснование решения на русском","summary_en":"короткое резюме на английском для администрации"}',
    'Для "reply" и "close" обязательны поля reply и reason; для "escalate" обязательно поле summary_en.',
  ].join('\n');
}

async function buildHistory(channel, ownerId) {
  const fetched = await channel.messages.fetch({ limit: 100 });
  const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return sorted.map((m) => {
    const text = m.content?.trim() || (m.attachments?.size ? '[вложение: скриншот или видео]' : '');
    if (m.author.bot) return { role: 'assistant', content: text || '[интерактивная панель]' };
    if (m.author.id === ownerId) return { role: 'user', content: text || '[пустое сообщение]' };
    return { role: 'user', content: `[СТАФФ] ${m.author.username}: ${text}` };
  });
}

function parseVerdict(raw) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('ИИ вернул ответ не в формате JSON');
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!['reply', 'close', 'escalate'].includes(parsed.action)) throw new Error(`ИИ вернул неизвестный action: ${parsed.action}`);
  if (parsed.action !== 'escalate' && !parsed.reply) throw new Error('ИИ вернул ответ без текста для игрока');
  return {
    action: parsed.action,
    reply: parsed.reply?.trim() || '',
    reason: parsed.reason?.trim() || '',
    summary_en: parsed.summary_en?.trim() || '',
  };
}

async function callOpenRouter(topicLabel, history) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'SwagHelpBot',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        max_tokens: 1000,
        messages: [{ role: 'system', content: buildSystemPrompt(topicLabel) }, ...history],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('пустой ответ модели');
    return parseVerdict(raw);
  } finally {
    clearTimeout(timer);
  }
}

function scheduleAITriage(channel, meta) {
  if (aiTimers.has(channel.id)) clearTimeout(aiTimers.get(channel.id));
  aiTimers.set(
    channel.id,
    setTimeout(() => {
      aiTimers.delete(channel.id);
      runAITriage(channel, meta).catch((err) => console.error(`[AI] Сбой триажа: ${err.message}`));
    }, 4000)
  );
}

async function runAITriage(channel, meta) {
  if (aiBusy.has(channel.id)) {
    scheduleAITriage(channel, meta);
    return;
  }
  aiBusy.add(channel.id);
  try {
    if (meta.value === 'staff') {
      humanTakeover.add(channel.id);
      await escalateTicket(channel, meta, {
        summary_en: 'Staff application submitted — human review required.',
        reason: 'Заявка в Staff: решение всегда принимают люди.',
      });
      return;
    }

    const parts = (channel.topic || '').split('|');
    const topicLabel = parts[2]?.trim() || parts[1]?.trim() || 'Обращение';
    const history = await buildHistory(channel, meta.userId);
    const verdict = await callOpenRouter(topicLabel, history);
    if (humanTakeover.has(channel.id)) {
      console.log(`[AI] ${channel.name}: вердикт отброшен — ИИ отключён командой администрации.`);
      return;
    }
    console.log(`[AI] ${channel.name}: ${verdict.action} — ${verdict.reason}`);
    await applyVerdict(channel, meta, verdict);
  } catch (err) {
    console.error(`[AI] Ошибка триажа (${channel.name}): ${err.message}`);
    humanTakeover.add(channel.id);
    await escalateTicket(channel, meta, {
      summary_en: 'Automatic AI triage failed. Please handle this ticket manually.',
      reason: `Сбой ИИ: ${err.message}`,
    }).catch(() => {});
  } finally {
    aiBusy.delete(channel.id);
  }
}

async function applyVerdict(channel, meta, verdict) {
  if (verdict.action === 'close') {
    await channel.send(verdict.reply || 'Вопрос решён — тикет закрыт.');
    await channel.send({ components: [ticketClosedPanel(20)], flags: MessageFlags.IsComponentsV2 });
    scheduleChannelClose(channel, 20_000);
  } else if (verdict.action === 'reply') {
    await channel.send(verdict.reply);
  } else {
    humanTakeover.add(channel.id);
    await escalateTicket(channel, meta, verdict);
  }
}

async function escalateTicket(channel, meta, verdict) {
  const roleId = STAFF_ROLE_ID;
  if (roleId) {
    const role = await channel.guild.roles.fetch(roleId).catch(() => null);
    if (role) {
      await channel.permissionOverwrites
        .edit(roleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          ManageMessages: true,
        })
        .catch(() => {});
    } else {
      console.error(`[AI] Роль администрации ${roleId} не найдена на сервере.`);
    }
  }

  const parts = (channel.topic || '').split('|');
  const label = parts[2]?.trim() || parts[1]?.trim() || 'Unknown';
  const lines = [
    '🔴 **Staff review required**',
    '',
    roleId ? `<@&${roleId}> — this ticket needs a human decision.` : '**This ticket needs a human decision.**',
    `- **Player:** <@${meta.userId}>`,
    `- **Topic:** ${label}`,
    verdict.summary_en ? `- **AI assessment:** ${verdict.summary_en}` : null,
    verdict.reason ? `- **Reason (RU):** ${verdict.reason}` : null,
    '',
    '-# AI triage — the player is waiting for a staff reply in this channel.',
  ].filter(Boolean);
  await channel.send({ content: lines.join('\n'), allowedMentions: { roles: roleId ? [roleId] : [] } });
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
  if (STAFF_ROLE_ID) {
    const staffRole = await guild.roles.fetch(STAFF_ROLE_ID).catch(() => null);
    if (!staffRole) {
      console.error(`[${guild.name}] STAFF_ROLE_ID (${STAFF_ROLE_ID}) не найден — пинг администрации при эскалации не сработает.`);
    }
  }
  if (TICKET_CATEGORY_ID) {
    const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
    if (!category) console.error(`[${guild.name}] Категория ${TICKET_CATEGORY_ID} не найдена — тикеты создадутся без категории.`);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Бот запущен как ${c.user.tag}`);
  if (AI_ENABLED) {
    console.log(`ИИ-триаж тикетов включён: OpenRouter, модель ${OPENROUTER_MODEL}.`);
    console.log(
      STAFF_ROLE_ID
        ? `Пинг администрации при эскалации: роль ${STAFF_ROLE_ID}.`
        : 'STAFF_ROLE_ID не задан — эскалация уйдёт без пинга роли.'
    );
  } else {
    console.log('ИИ-триаж выключен (OPENROUTER_API_KEY не задан) — тикеты обрабатывает только администрация.');
  }
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
  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ManageMessages,
  ];
  for (const roleId of new Set([SUPPORT_ROLE_ID, STAFF_ROLE_ID])) {
    if (roleId) overwrites.push({ id: roleId, allow: staffAllow });
  }

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `ticket-${topic.slug}-${userName}`.slice(0, 100),
      type: ChannelType.GuildText,
      topic: `ticket:${i.user.id}|${topic.value}|${topic.label}`,
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
  if (!isOwner && !isStaffMember(i.member)) {
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
  await i.channel.send({ components: [ticketClosedPanel(10)], flags: MessageFlags.IsComponentsV2 });
  acknowledgedTickets.delete(i.channelId);
  humanTakeover.delete(i.channelId);
  scheduleChannelClose(i.channel, 10_000);
}

function isStaffMember(member) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    Boolean(SUPPORT_ROLE_ID && member.roles.cache.has(SUPPORT_ROLE_ID)) ||
    Boolean(STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID))
  );
}

async function handleAIOff(i) {
  const meta = parseTicketTopic(i.channel?.topic);
  if (!meta) {
    await i.reply({ content: 'Эта команда работает только внутри тикета.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!isStaffMember(i.member)) {
    await i.reply({ content: 'Команда доступна только администрации.', flags: MessageFlags.Ephemeral });
    return;
  }

  humanTakeover.add(i.channelId);
  if (aiTimers.has(i.channelId)) {
    clearTimeout(aiTimers.get(i.channelId));
    aiTimers.delete(i.channelId);
  }
  if (closeTimers.has(i.channelId)) {
    clearTimeout(closeTimers.get(i.channelId));
    closeTimers.delete(i.channelId);
  }
  await i.reply({
    content: AI_ENABLED
      ? '🤖 ИИ отключён в этом тикете: бот больше не отвечает и не закрывает его автоматически. Дальше тикет ведёт администрация.'
      : 'ИИ-триаж и так выключен на всём сервере — тикет ведёт администрация.',
  });
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand() && i.commandName === 'setup-tickets') {
      await handleSetupTickets(i);
    } else if (i.isChatInputCommand() && i.commandName === 'ai-off') {
      await handleAIOff(i);
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
  if (!meta || msg.author.id !== meta.userId) return;

  if (closeTimers.has(msg.channelId)) {
    clearTimeout(closeTimers.get(msg.channelId));
    closeTimers.delete(msg.channelId);
    await msg.reply({ content: '⏳ Автозакрытие отменено — тикет снова открыт.' }).catch(() => {});
  }

  if (!AI_ENABLED) {
    if (acknowledgedTickets.has(msg.channelId)) return;
    acknowledgedTickets.add(msg.channelId);
    await msg.reply({ content: '✅ Сообщение получено — администрация ответит здесь в ближайшее время.' }).catch(() => {});
    return;
  }

  if (humanTakeover.has(msg.channelId)) return;
  scheduleAITriage(msg.channel, meta);
});

client.on(Events.ChannelDelete, (channel) => {
  for (const map of [closeTimers, aiTimers]) {
    if (map.has(channel.id)) {
      clearTimeout(map.get(channel.id));
      map.delete(channel.id);
    }
  }
  aiBusy.delete(channel.id);
  humanTakeover.delete(channel.id);
  acknowledgedTickets.delete(channel.id);
});

client.login(TOKEN);
