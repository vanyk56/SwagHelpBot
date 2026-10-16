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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DEFAULT_RULES = `Незнание правил не освобождает от ответственности: подключаясь к серверу, находясь в Discord-сообществе или покупая товары в магазине, игрок автоматически соглашается со всеми пунктами правил.

### Раздел 1. Проверки и запрещённое ПО
- 1.1. Каждый игрок обязан иметь установленный Discord — вызов на проверку только через него.
- 1.2. На явку после вызова на проверку — не более 3 минут. Неявка = отказ → перманентный бан.
- 1.3. Запрещено покидать сервер или закрывать игру во время вызова и проверки без разрешения проверяющего → перманентный бан за уход от проверки.
- 1.4. Отказ выполнить требования проверяющего (демонстрация экрана, доступ к папкам, запуск чекеров) или затягивание времени = отказ → перманентный бан.
- 1.5. Проверка строго один на один: игрок и назначенный сотрудник. Посторонние со стороны игрока запрещены.
- 1.6. Нарушение сотрудником порядка проверки — игрок оформляет официальную жалобу в тикетах с видеофиксацией.
- 1.7. Следы удалённых читов/макросов или утилит для скрытия/очистки следов перед проверкой → перманентный бан.
- 1.8. Любое стороннее ПО, дающее преимущество (AIM, WH, ESP, Silent, Debug Camera и др.) → перманентный бан по SteamID / IP / HWID.
- 1.9. Макросы и скрипты (софт мыши, сторонние программы) для контроля отдачи или автоматизации стрельбы → перманентный бан.

### Раздел 2. Общение и чат
- 2.1. Выдача себя за персонал проекта → мут или бан по решению модерации.
- 2.2. Реклама сторонних проектов, сайтов и сообществ → перманентный мут или перманентный бан.
- 2.3. Флуд и спам → мут чата от 30 минут до нескольких часов.
- 2.4. Нацизм, шовинизм, разжигание вражды, доксинг, деанон, слив личной информации игроков и сотрудников → перманентный бан на всех ресурсах проекта.
- 2.5. RMT: продажа/покупка ресурсов, лута и шкафов за реальные деньги, публикация реквизитов для сделок → перманентный бан продавца и покупателя.
- 2.6. Оскорбления, клевета и провокации в сторону администрации → мут от 2 часов до бана аккаунта.

### Раздел 3. Строительство
- 3.1. Намеренный обход и абьюз лимитов построек, турелей, электроники и других объектов → бан от 3 дней + принудительное удаление нарушающих объектов.

### Раздел 4. Игровой процесс
- 4.1. Игра с читером в команде: первый раз — предупреждение, при повторе — бан всей команды от 3 дней.
- 4.2. Накрутка статистики и KD (откидывание спальников под предлогом подарков с последующими убийствами) → обнуление статистики или бан.
- 4.3. Прозрачные и полупрозрачные сеты брони/одежды, дающие преимущество видимости → изъятие скинов, при повторном нарушении — бан.
- 4.4. DDoS сервера, угрозы атаки или содействие им → перманентный бан по IP / HWID без права на разбан.
- 4.5. Внутриигровой обман (скам) между игроками РАЗРЕШЁН и не наказывается; исключение — торговля за реальные деньги (п. 2.5).

### Раздел 5. Донат и магазин
- 5.1. Покупки в магазине — добровольные пожертвования на развитие сервера, возврату не подлежат.
- 5.2. При блокировке аккаунта купленные товары и услуги не переносятся на другой аккаунт и не компенсируются.
- 5.3. При утере данных от аккаунта возврат или перенос — только при исчерпывающих и весомых доказательствах владения.`;

const TOKEN = process.env.TOKEN?.trim();
const ROLE_ID = process.env.ROLE_ID?.trim();
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID?.trim() || null;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID?.trim() || null;
const BRAND_COLOR = parseInt((process.env.BRAND_COLOR || 'D99A8C').replace('#', ''), 16);
const MESSAGE_CONTENT = process.env.ENABLE_MESSAGE_CONTENT === 'true';
const AI_BASE_URL = process.env.AI_BASE_URL?.trim().replace(/\/+$/, '') || 'https://openrouter.ai/api/v1';
const AI_API_KEY = process.env.AI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || null;
const AI_MODEL = process.env.AI_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-haiku-5.5';
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID?.trim() || process.env.SUPPORT_ROLE_ID?.trim() || null;
const SERVER_NAME = process.env.SERVER_NAME?.trim() || 'SWAG RUST';
const SERVER_CONNECT = process.env.SERVER_CONNECT?.trim() || '157.85.87.131:28061';
const SERVER_SITE = process.env.SERVER_SITE?.trim() || 'https://swagrust.ru/';
const AI_RULES = (process.env.AI_RULES?.trim() || DEFAULT_RULES).replace(/\\n/g, '\n');
const AI_IDLE_CLOSE_MINUTES = parseInt(process.env.AI_IDLE_CLOSE_MINUTES || '5', 10);
const COMPLAINTS_LOG_CHANNEL_ID = process.env.COMPLAINTS_LOG_CHANNEL_ID?.trim() || null;
const GAME_API_SECRET = process.env.GAME_API_SECRET?.trim() || null;
const AI_ENABLED = Boolean(AI_API_KEY);

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
    'ВНИМАНИЕ: задан ключ ИИ, но ENABLE_MESSAGE_CONTENT != true — ИИ не сможет читать сообщения. Включите Message Content Intent в Discord Developer Portal и поставьте ENABLE_MESSAGE_CONTENT=true.'
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
  new SlashCommandBuilder()
    .setName('setup-complaints')
    .setDescription('Опубликовать панель жалоб на игроков в этом канале и закрепить её')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('setup-complaints-log')
    .setDescription('Назначить этот канал каналом приёма жалоб для администрации')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('game-reports')
    .setDescription('Сколько репортов висит на игроке в игре (живые данные сервера)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('query').setDescription('Ник или Steam ID игрока').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('game-players')
    .setDescription('Поиск игроков игрового сервера по нику или Steam ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('query').setDescription('Ник или Steam ID').setRequired(true))
    .toJSON(),
];

const acknowledgedTickets = new Set();
const closeTimers = new Map();
const aiTimers = new Map();
const aiBusy = new Set();
const humanTakeover = new Set();
const idleCloseTimers = new Map();

const STATE_FILE = path.join(process.cwd(), 'data', 'state.json');
const complaintLogChannels = new Map();
try {
  if (fs.existsSync(STATE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    for (const [guildId, channelId] of Object.entries(saved.complaintLogChannels || {})) {
      complaintLogChannels.set(guildId, channelId);
    }
  }
} catch (err) {
  console.error('Не удалось загрузить data/state.json:', err.message);
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ complaintLogChannels: Object.fromEntries(complaintLogChannels) }, null, 2));
  } catch (err) {
    console.error('Не удалось сохранить data/state.json:', err.message);
  }
}

const gameState = {
  updatedAt: 0,
  firstSync: true,
  players: new Map(),
  reports: [],
  verified: new Map(),
  activeChecks: [],
};
const knownGameReportKeys = new Set();
const gameCommandQueue = [];
let gameCommandSeq = 0;

function gameConnected() {
  return gameState.updatedAt > 0 && Date.now() - gameState.updatedAt < 3 * 60_000;
}

function gameReportsFor(targetId) {
  return gameState.reports.filter((r) => r.targetId === targetId);
}

function findGamePlayers(query, limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const found = [];
  for (const p of gameState.players.values()) {
    if ((p.name || '').toLowerCase().includes(q) || (p.id || '').includes(q)) {
      found.push(p);
      if (found.length >= limit) break;
    }
  }
  return found;
}

function enqueueGameCommand(cmd) {
  gameCommandQueue.push({ id: `cmd${++gameCommandSeq}`, ...cmd });
  console.log(`[API:игра] Команда поставлена в очередь: ${cmd.type}`);
}

async function announceInGameReport(report, total) {
  for (const guild of client.guilds.cache.values()) {
    const log = await getComplaintLogChannel(guild).catch(() => null);
    if (!log) continue;
    const lines = [
      '🎮 **In-game report received**',
      '',
      STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}> — new report from the game server.` : '**New report from the game server.**',
      `- **Target:** ${report.targetName} (${report.targetId}) — **${total}** in-game reports total`,
      `- **By:** ${report.reporterName}`,
      `- **Reason:** ${report.reason}`,
      `- **Time:** <t:${report.unixTime}:R>`,
      '',
      '-# Player list and full stats: /game-reports, /game-players.',
    ];
    await log
      .send({ content: lines.join('\n'), allowedMentions: { roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : [] } })
      .catch((err) => console.error(`[API:игра] Не удалось отправить анонс репорта: ${err.message}`));
  }
}

async function applyGameSnapshot(payload) {
  gameState.updatedAt = Date.now();
  gameState.players = new Map((payload.players || []).map((p) => [p.id, p]));
  gameState.reports = payload.reports || [];
  gameState.verified = new Map((payload.verified || []).map((v) => [v.id, v.until]));
  gameState.activeChecks = payload.activeChecks || [];

  for (const r of payload.results || []) {
    if (r?.result && r.result.ok === false) {
      console.error(`[API:игра] Команда ${r.type} (${r.id}) не выполнена: ${r.result.error}`);
    }
  }

  if (gameState.firstSync) {
    gameState.firstSync = false;
    for (const r of gameState.reports) knownGameReportKeys.add(r.key);
    console.log(`[API:игра] Первый снимок: игроков ${gameState.players.size}, репортов ${gameState.reports.length}, проверок ${gameState.activeChecks.length}.`);
    return;
  }

  for (const r of gameState.reports) {
    if (knownGameReportKeys.has(r.key)) continue;
    knownGameReportKeys.add(r.key);
    if (String(r.reporterId) === '0') continue;
    const total = gameState.reports.filter((x) => x.targetId === r.targetId).length;
    await announceInGameReport(r, total).catch(() => {});
  }
}

function startApiServer() {
  const port = parseInt(process.env.PORT || '3000', 10);
  if (!Number.isFinite(port)) return;

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }

      if (req.method !== 'POST' || req.url !== '/api/report') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }

      if (!GAME_API_SECRET) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('game api disabled');
        return;
      }
      if (req.headers.authorization !== `Bearer ${GAME_API_SECRET}`) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('unauthorized');
        return;
      }

      let body = '';
      for await (const chunk of req) body += chunk;
      if (body.length > 5_000_000) {
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        res.end('too large');
        return;
      }
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('bad json');
        return;
      }

      await applyGameSnapshot(payload);
      const commands = gameCommandQueue.splice(0, 10);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ commands }));
    } catch (err) {
      console.error('[API:игра] Ошибка обработки запроса:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('internal error');
      }
    }
  });

  server.listen(port, () => {
    console.log(`API игрового сервера слушает порт ${port}${GAME_API_SECRET ? ' (секрет задан)' : ' (секрет НЕ задан — плагин не подключится)'}`);
  });
}

function parseTicketTopic(topic) {
  if (!topic || !topic.startsWith('ticket:')) return null;
  const parts = topic.split('|');
  const userId = parts[0].replace('ticket:', '').trim();
  if (!userId) return null;
  return { userId, value: parts[1]?.trim() || null };
}

function parseComplaintTopic(topic) {
  if (!topic || !topic.startsWith('complaint:')) return null;
  const parts = topic.split('|');
  const userId = parts[0].replace('complaint:', '').trim();
  if (!userId) return null;
  return { userId, key: parts[1]?.trim() || '', display: parts[2]?.trim() || 'неизвестный игрок' };
}

function parseChannelTopic(topic) {
  const ticket = parseTicketTopic(topic);
  if (ticket) return { kind: 'ticket', ...ticket };
  const complaint = parseComplaintTopic(topic);
  if (complaint) return { kind: 'complaint', ...complaint };
  return null;
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

function complaintsPanel() {
  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '# 🚨 Жалобы на игроков',
          '### Заметили читера или нарушителя?',
          '> Опишите нарушение и приложите доказательства — жалоба уйдёт администрации приватно.',
          '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
          '- 📹 Приложите **видео или скриншоты**, если они есть — это ускорит рассмотрение',
          '- 🆔 Укажите **ник игрока и Steam ID** — если ID неизвестен, бот найдёт игрока по нику',
          '- 🔒 Всё **строго конфиденциально** — игрок не узнает, кто пожаловался',
          '',
          '-# Ложные жалобы и обращения «просто узнать информацию» не рассматриваются.',
        ].join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('complaint_open')
          .setLabel('Подать жалобу')
          .setEmoji('🚨')
          .setStyle(ButtonStyle.Danger)
      )
    );
}

function complaintWelcomePanel(member, display) {
  return new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '# 🚨 Жалоба на игрока',
          `> Подал: ${member}`,
          `> Игрок: ${display}`,
          '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
          '### Что нужно для рассмотрения',
          '- 📹 **Видео или скриншоты** — по желанию: жалоба без доказательств всё равно будет принята и передана администрации',
          '- 🆔 **Steam ID** игрока — если не указали, ИИ уточнит личность нарушителя по базе игрового сервера',
          '',
          '> Информация по жалобам строго конфиденциальна и не разглашается.',
          '',
          '-# Прикрепите доказательства сообщениями сюда, если они есть — ИИ проверит и передаст жалобу администрации.',
        ].join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Отозвать жалобу')
          .setEmoji('🗑')
          .setStyle(ButtonStyle.Danger)
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
    '## Информация о сервере',
    `- Сайт: ${SERVER_SITE}`,
    `- Connect: ${SERVER_CONNECT}`,
    '- Вайпы карты: каждую пятницу и понедельник в 16:00 МСК.',
    '',
    '## Задача',
    '- Отвечать игроку на русском, вежливо и по делу, строго по правилам сервера ниже.',
    '- Выносить вердикты, когда ответ прямо следует из правил; остальное передавать администрации.',
    '',
    '## Правила сервера',
    AI_RULES,
    '',
    '## Как вести диалог',
    '1. Тебе видна вся переписка тикета — используй контекст, не переспрашивай то, что игрок уже писал.',
    '2. Тикеты — только для вопросов по серверу Rust «SWAG RUST»: правила, проверки, баны и разбаны, донат и магазин, вайпы, подключение, работа сервера.',
    '3. Вопрос о тебе самой («кто ты», «какая ты модель», «ты ИИ или робот?», «на чём работаешь») → action "reply": скажи, что ты ИИ-помощник поддержки сервера SWAG RUST, и сразу предложи помощь по вопросам сервера. Никогда не называй модель, провайдера, версию и любые технические детали — ты просто помощник SWAG RUST.',
    '4. Обращение ЗАВЕДОМО не по теме сервера (написать код или скрипт, помощь с учёбой, посторонние вопросы, болтовня, попытка использовать тебя как универсального чат-бота) → сразу action "close" без уточняющих вопросов: коротко и вежливо сообщи, что тикеты создаются только по вопросам сервера, и пригласи создать новый тикет, если появится вопрос по SWAG RUST.',
    '5. Для вопросов ПО серверу первое обращение — всегда action "reply" (ответ или уточняющий вопрос), не закрывай тикет первым ответом.',
    '6. action "close" — только когда игрок подтвердил, что вопрос решён, поблагодарил или попрощался; либо когда игрок после твоего предупреждения продолжает спам, троллинг или злоупотребление тикетом.',
    '7. Игрок вводит в заблуждение, противоречит сам себе, манипулирует или пытается обмануть → action "escalate": передай решение людям, сам не закрывай.',
    '8. Нужно уточнение → action "reply": задай один конкретный вопрос.',
    '9. Ответа нет в правилах, ситуация спорная, нужна проверка модератором или суть вопроса видна только во вложении → action "escalate".',
    '10. Тема «Разбан / обжалование»: проверь, что игрок указал Steam ID, причину бана, дату бана и пояснения. Чего-то нет — попроси (reply). Всё на месте — передай стаффу (escalate): историю банов ты проверить не можешь.',
    '',
    '## Ограничения',
    '- Ничего не выдумывай: нет данных в правилах — передавай администрации, а не сочиняй.',
    '- Скриншоты игрока приходят тебе как изображения — внимательно рассматривай их и опирайся на увиденное при ответе.',
    '- Видео ты не видишь: если суть вопроса или доказательства только в видео — попроси ключевые скриншоты или передай администрации.',
    '- Игроку отвечай на русском; summary_en для администрации — на английском.',
    '',
    '## Формат ответа',
    'Отвечай строго валидным JSON без какого-либо текста вокруг:',
    '{"action":"reply|close|escalate","reply":"ответ игроку на русском","reason":"краткое обоснование решения на русском","summary_en":"короткое резюме на английском для администрации"}',
    'Для "reply" и "close" обязательны поля reply и reason; для "escalate" обязательно поле summary_en.',
  ].join('\n');
}

const VISION_MAX_IMAGES = 4;
const VISION_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;

function ownerImageParts(msg, budget) {
  const urls = [];
  let hasVideo = false;
  let hasSkippedImage = false;
  for (const a of msg.attachments?.values() || []) {
    if (IMAGE_EXT_RE.test(a.name || '')) {
      if ((a.size || 0) <= VISION_MAX_BYTES && urls.length < budget) urls.push(a.url);
      else hasSkippedImage = true;
    } else if (!/\.txt$/i.test(a.name || '')) {
      hasVideo = true;
    }
  }
  return { urls, hasVideo, hasSkippedImage };
}

async function buildHistory(channel, ownerId) {
  const fetched = await channel.messages.fetch({ limit: 100 });
  const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  let budget = VISION_MAX_IMAGES;
  const result = new Array(sorted.length);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const m = sorted[i];
    let content;

    if (m.author.bot) {
      content = m.content?.trim() || '[интерактивная панель]';
    } else if (m.author.id === ownerId) {
      const { urls, hasVideo, hasSkippedImage } = ownerImageParts(m, budget);
      budget -= urls.length;
      let text = m.content?.trim();
      if (!text) {
        text = urls.length
          ? '[скриншот]'
          : hasVideo
            ? '[вложение: видео]'
            : hasSkippedImage
              ? '[вложение: изображение]'
              : '[пустое сообщение]';
      }
      content = urls.length
        ? [{ type: 'text', text }, ...urls.map((u) => ({ type: 'image_url', image_url: { url: u } }))]
        : text;
    } else {
      content = `[СТАФФ] ${m.author.username}: ${m.content?.trim() || '[вложение]'}`;
    }

    result[i] = { role: m.author.bot ? 'assistant' : 'user', content };
  }
  return result;
}

function parseVerdict(raw, allowedActions = ['reply', 'close', 'escalate']) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let parsed = null;
  if (start !== -1 && end > start) {
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      parsed = null;
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && allowedActions.includes(parsed.action)) {
    if (parsed.action !== 'escalate' && !parsed.reply) throw new Error('ИИ вернул ответ без текста для игрока');
    return {
      action: parsed.action,
      reply: parsed.reply?.trim() || '',
      reason: parsed.reason?.trim() || '',
      summary_en: parsed.summary_en?.trim() || '',
      complaint_ru: parsed.complaint_ru?.trim() || '',
      resolved:
        parsed.resolved && typeof parsed.resolved === 'object'
          ? { id: String(parsed.resolved.id || '').trim(), name: String(parsed.resolved.name || '').trim() }
          : null,
    };
  }
  // Модель ответила вне контракта (просто текст или JSON с неизвестным action) —
  // не срываем триаж: отправляем игроку как обычный ответ.
  const plainReply =
    (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) || (parsed ? null : text);
  if (plainReply && allowedActions.includes('reply')) {
    return {
      action: 'reply',
      reply: plainReply.trim(),
      reason: parsed
        ? 'ИИ вернул JSON с неизвестным action — использован его текст ответа.'
        : 'ИИ ответил обычным текстом вместо JSON — текст отправлен игроку.',
      summary_en: '',
      complaint_ru: '',
      resolved: null,
    };
  }
  throw new Error('ИИ вернул ответ не в формате JSON');
}

async function callLLM(systemPrompt, history, allowedActions) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        max_tokens: 1000,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ИИ API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('пустой ответ модели');
    return parseVerdict(raw, allowedActions);
  } finally {
    clearTimeout(timer);
  }
}

function scheduleAITriage(channel, meta, delay = 4000) {
  if (aiTimers.has(channel.id)) clearTimeout(aiTimers.get(channel.id));
  aiTimers.set(
    channel.id,
    setTimeout(() => {
      aiTimers.delete(channel.id);
      runAITriage(channel, meta).catch((err) => console.error(`[AI] Сбой триажа: ${err.message}`));
    }, delay)
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
    const verdict = await callLLM(buildSystemPrompt(topicLabel), history);
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
      summary_en: 'Сбой автоматического ИИ-триажа — тикет передан администрации.',
      reason: `Сбой ИИ: ${err.message}`,
    }).catch(() => {});
  } finally {
    aiBusy.delete(channel.id);
  }
}

function scheduleIdleClose(channel) {
  if (idleCloseTimers.has(channel.id)) clearTimeout(idleCloseTimers.get(channel.id));
  idleCloseTimers.set(
    channel.id,
    setTimeout(async () => {
      idleCloseTimers.delete(channel.id);
      if (humanTakeover.has(channel.id) || closeTimers.has(channel.id)) return;
      try {
        await channel.send({
          components: [
            new ContainerBuilder()
              .setAccentColor(BRAND_COLOR)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  [
                    '# 💤 Тикет закрыт: нет ответа',
                    `> Игрок не отвечал более ${AI_IDLE_CLOSE_MINUTES} минут после ответа поддержки.`,
                    '-# Вопрос решён? Отлично! Если нет — создайте новый тикет в канале поддержки.',
                  ].join('\n')
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
        scheduleChannelClose(channel, 15_000);
      } catch (err) {
        console.error(`[AI] Не удалось закрыть тикет после неактивности (${channel.name}): ${err.message}`);
      }
    }, AI_IDLE_CLOSE_MINUTES * 60_000)
  );
}

async function applyVerdict(channel, meta, verdict) {
  if (verdict.action === 'close') {
    if (idleCloseTimers.has(channel.id)) {
      clearTimeout(idleCloseTimers.get(channel.id));
      idleCloseTimers.delete(channel.id);
    }
    await channel.send(
      `${verdict.reply || 'Вопрос решён — тикет закрыт.'}\n\n-# Если вопрос не решён — напишите сообщение в ближайшие 20 секунд, и автозакрытие отменится.`
    );
    await channel.send({ components: [ticketClosedPanel(20)], flags: MessageFlags.IsComponentsV2 });
    scheduleChannelClose(channel, 20_000);
  } else if (verdict.action === 'reply') {
    await channel.send(verdict.reply);
    scheduleIdleClose(channel);
  } else {
    humanTakeover.add(channel.id);
    await escalateTicket(channel, meta, verdict);
  }
}

async function escalateTicket(channel, meta, verdict) {
  if (idleCloseTimers.has(channel.id)) {
    clearTimeout(idleCloseTimers.get(channel.id));
    idleCloseTimers.delete(channel.id);
  }
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
  const label = parts[2]?.trim() || parts[1]?.trim() || 'Обращение';
  const lines = [
    '🔴 **Нужно решение администрации**',
    '',
    roleId ? `<@&${roleId}> — этот тикет требует решения живого человека.` : '**Этот тикет требует решения живого человека.**',
    `- **Игрок:** <@${meta.userId}>`,
    `- **Тема:** ${label}`,
    verdict.summary_en ? `- **Оценка ИИ:** ${verdict.summary_en}` : null,
    verdict.reason ? `- **Причина:** ${verdict.reason}` : null,
    '',
    '-# ИИ-триаж — игрок ждёт ответа администрации в этом канале.',
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
    console.log(`ИИ-триаж тикетов включён: модель ${AI_MODEL} через ${AI_BASE_URL}.`);
    console.log(
      STAFF_ROLE_ID
        ? `Пинг администрации при эскалации: роль ${STAFF_ROLE_ID}.`
        : 'STAFF_ROLE_ID не задан — эскалация уйдёт без пинга роли.'
    );
  } else {
    console.log('ИИ-триаж выключен (ключ ИИ не задан) — тикеты обрабатывает только администрация.');
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
    if (AI_ENABLED && !(complaintLogChannels.get(guild.id) || COMPLAINTS_LOG_CHANNEL_ID)) {
      console.warn(
        `[${guild.name}] Канал приёма жалоб не настроен — запустите /setup-complaints-log в канале администрации (или задайте COMPLAINTS_LOG_CHANNEL_ID).`
      );
    }
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

function buildPrivateOverwrites(guild, authorId) {
  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ManageMessages,
  ];
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: authorId,
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
  for (const roleId of new Set([SUPPORT_ROLE_ID, STAFF_ROLE_ID])) {
    if (roleId) overwrites.push({ id: roleId, allow: staffAllow });
  }
  return overwrites;
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
  const overwrites = buildPrivateOverwrites(i.guild, i.user.id);

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
  return parseChannelTopic(i.channel?.topic);
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
  for (const map of [acknowledgedTickets, humanTakeover]) map.delete(i.channelId);
  for (const map of [closeTimers, aiTimers, idleCloseTimers]) {
    if (map.has(i.channelId)) {
      clearTimeout(map.get(i.channelId));
      map.delete(i.channelId);
    }
  }
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
  for (const map of [closeTimers, idleCloseTimers]) {
    if (map.has(i.channelId)) {
      clearTimeout(map.get(i.channelId));
      map.delete(i.channelId);
    }
  }
  await i.reply({
    content: AI_ENABLED
      ? '🤖 ИИ отключён в этом тикете: бот больше не отвечает и не закрывает его автоматически. Дальше тикет ведёт администрация.'
      : 'ИИ-триаж и так выключен на всём сервере — тикет ведёт администрация.',
  });
}

const STEAM_ID_RE = /^\d{15,18}$/;

function complaintNick(meta) {
  return (meta.display || '').split(' · ')[0].trim();
}

function sanitizeGameName(name) {
  return String(name || '').replace(/\|/g, '/').trim().slice(0, 100);
}

function exactGamePlayerByNick(nick) {
  const q = (nick || '').trim().toLowerCase();
  if (!q || !gameConnected()) return null;
  let match = null;
  for (const p of gameState.players.values()) {
    if ((p.name || '').trim().toLowerCase() === q) {
      if (match) return null;
      match = p;
    }
  }
  return match;
}

function complaintCandidatesFor(meta, history) {
  const list = new Map();
  const nick = complaintNick(meta);
  if (nick) {
    for (const p of findGamePlayers(nick, 5)) list.set(p.id, p);
  }
  for (const m of history.slice(-20)) {
    if (m.role !== 'user') continue;
    const text =
      typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map((p) => p.text || '').join(' ')
          : '';
    for (const idm of text.matchAll(/\b\d{15,18}\b/g)) {
      for (const p of findGamePlayers(idm[0], 3)) list.set(p.id, p);
    }
  }
  return [...list.values()].slice(0, 8);
}

async function applyResolvedTarget(channel, meta, resolved) {
  const id = (resolved?.id || '').trim();
  if (!STEAM_ID_RE.test(id)) return meta;
  const known = gameState.players.get(id);
  if (!known) {
    console.warn(`[AI:жалобы] ${channel.name}: ИИ указал игрока вне базы игрового сервера (${id}) — идентификация отклонена.`);
    return meta;
  }
  const name = sanitizeGameName(resolved.name) || sanitizeGameName(known.name) || id;
  const display = `${name} · ${id}`;
  try {
    await channel.setTopic(`complaint:${meta.userId}|${id}|${display}`, 'Жалоба: личность нарушителя уточнена');
  } catch (err) {
    console.error(`[AI:жалобы] ${channel.name}: не удалось обновить тему канала: ${err.message}`);
    return meta;
  }
  await channel.send(`-# ✅ Личность нарушителя уточнена: **${name}** · \`${id}\``).catch(() => {});
  console.log(`[AI:жалобы] ${channel.name}: цель жалобы уточнена — ${display}`);
  return { kind: 'complaint', userId: meta.userId, key: id, display };
}

async function tryAutoResolveComplaint(channel, meta) {
  if (STEAM_ID_RE.test(meta.key)) return meta;
  const exact = exactGamePlayerByNick(complaintNick(meta));
  if (!exact) return meta;
  return applyResolvedTarget(channel, meta, { id: exact.id, name: exact.name });
}

function buildIdentitySection(meta, candidates) {
  const nick = complaintNick(meta);
  if (STEAM_ID_RE.test(meta.key)) {
    const known = gameConnected() ? gameState.players.get(meta.key) : null;
    return known
      ? [
          '## Личность нарушителя — установлена',
          `Нарушитель идентифицирован: точный ник «${sanitizeGameName(known.name)}», Steam ID ${known.id}${known.online ? ', сейчас в сети' : ''}. Используй именно эти данные и не переспрашивай автора.`,
        ]
      : ['## Личность нарушителя — установлена', `Нарушитель идентифицирован по Steam ID: ${meta.key}.`];
  }
  if (!gameConnected()) {
    return [
      '## Личность нарушителя',
      `Автор указал только ник «${nick}». Игровой сервер сейчас не подключён — проверить личность по базе игроков нельзя. Действуй по общим правилам жалобы.`,
    ];
  }
  if (candidates.length) {
    const list = candidates
      .map((p, idx) => `${idx + 1}. «${sanitizeGameName(p.name)}» — Steam ID ${p.id}${p.online ? ' · сейчас в сети' : ''}`)
      .join('\n');
    return [
      '## Личность нарушителя — нужно уточнение',
      `Автор указал только ник «${nick}» — Steam ID неизвестен. База игроков игрового сервера нашла кандидатов:`,
      list,
      '',
      'Порядок действий:',
      '1. Пока автор не подтвердил личность — спроси его (reply), кого он имел в виду: назови кандидатов с их Steam ID и попроси подтвердить. Одно короткое сообщение.',
      '2. Автор подтвердил («да», назвал точный ник или Steam ID) → добавь в JSON-ответ поле "resolved" с id строго из списка выше и продолжай обычную проверку жалобы.',
      '3. Никто из кандидатов не подходит → попроси точный ник или Steam ID игрока.',
      '4. Автор не может уточнить — не отклоняй жалобу из-за этого: проверь доказательства и передай администрации (submit) без "resolved", личность установит администрация.',
    ];
  }
  return [
    '## Личность нарушителя',
    `Автор указал только ник «${nick}», но такого игрока нет в актуальной базе игрового сервера. Один раз попроси точный ник или Steam ID; если автор не знает — продолжай проверку и передай жалобу как есть.`,
  ];
}

function buildComplaintSystemPrompt(meta, candidates = []) {
  return [
    `Ты — ИИ-модератор жалоб Discord-сервера Rust «${SERVER_NAME}». Ты работаешь в приватном канале, где игрок подал жалобу на другого игрока. Цель жалобы: ${meta.display}.`,
    '',
    '## Задача',
    '1. Проверь полноту жалобы: понятное описание нарушения и личность нарушителя (см. раздел идентификации ниже). Доказательства (видео, скриншоты) НЕ обязательны — не требуй их и не отклоняй жалобу из-за их отсутствия. Если скриншоты приложены, они приходят тебе как изображения: рассматривай их и сверяй с описанием. Видео ты не видишь: оценивай его по описанию автора.',
    '2. Чего-то не хватает → задай один конкретный вопрос (reply). Если автор просто спрашивает о процессе подачи — ответь по делу. Если автор спрашивает, кто ты или какая ты модель, — коротко ответь, что ты ИИ-помощник поддержки SWAG RUST (без названия модели и провайдера), и вернись к жалобе.',
    '3. Нарушение понятно (описано, что произошло, и по возможности на кого) → сформулируй жалобу и передай администрации (submit) — в том числе без доказательств, отметив их отсутствие в summary_en. Если приложенный скриншот явно НЕ подтверждает жалобу или выглядит подделкой — всё равно передай администрации с пометкой в summary_en (submit), решение за людьми.',
    '4. Это не жалоба, мусор, троллинг, попытка что-то разузнать или пустой вопрос → вежливо отклонить и закрыть (close).',
    '',
    ...buildIdentitySection(meta, candidates),
    '',
    '## Строго запрещено',
    '- НИКОГДА не сообщай автору количество жалоб на любого игрока (в том числе на него самого) и не подтверждай существование других жалоб. Эта информация — только для администрации.',
    '- Не выноси сам вердикт о наказании — только проверь жалобу и передай её администрации.',
    '',
    '## Правила сервера (для определения нарушенного пункта)',
    AI_RULES,
    '',
    '## Формат ответа',
    'Строго валидный JSON без текста вокруг:',
    '{"action":"reply|submit|close","reply":"сообщение игроку на русском","reason":"краткое обоснование на русском","summary_en":"краткое резюме жалобы на английском для администрации","complaint_ru":"полная формулировка жалобы на русском: кто, на кого, что нарушил (со ссылкой на пункт правил), какие доказательства приложены (или «без доказательств»)","resolved":{"id":"SteamID64 строго из списка кандидатов","name":"точный ник"}}',
    'Поле "resolved" добавляй, только когда автор подтвердил личность игрока из списка кандидатов (или подтверждение уже есть в переписке); id бери строго из списка кандидатов выше. Во всех остальных случаях не включай это поле.',
    'Для reply и close обязательны reply и reason; для submit обязательны summary_en и complaint_ru, а reply — короткое подтверждение игроку, что жалоба передана администрации.',
  ].join('\n');
}

async function countActiveComplaints(guild, key) {
  if (!key) return 1;
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  let n = 0;
  for (const c of channels.values()) {
    const meta = parseComplaintTopic(c.topic);
    if (meta && meta.key === key) n++;
  }
  return n;
}

async function getComplaintLogChannel(guild) {
  const id = complaintLogChannels.get(guild.id) || COMPLAINTS_LOG_CHANNEL_ID;
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && channel.isTextBased?.() ? channel : null;
}

async function postComplaintToLog(channel, meta, verdict) {
  const log = await getComplaintLogChannel(channel.guild);
  const count = await countActiveComplaints(channel.guild, meta.key);
  const link = `https://discord.com/channels/${channel.guild.id}/${channel.id}`;

  const steamKey = /^\d{15,18}$/.test(meta.key) ? meta.key : null;
  const gameOnline = gameConnected();
  const inGameReports = steamKey ? gameReportsFor(steamKey).length : 0;
  let syncingToGame = false;
  if (gameOnline && steamKey) {
    const nick = meta.display.split(' · ')[0] || meta.display;
    const author = await channel.guild.members.fetch(meta.userId).catch(() => null);
    enqueueGameCommand({
      type: 'add_report',
      targetId: steamKey,
      targetName: nick,
      reporterName: author?.user?.username || 'unknown',
      reason: 'Жалоба из Discord',
    });
    syncingToGame = true;
  }

  const lines = [
    '🔴 **New player complaint**',
    '',
    STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}> — please review this complaint.` : '**Please review this complaint.**',
    `- **Target:** ${meta.display}`,
    `- **Author:** <@${meta.userId}>`,
    `- **Active complaints on this player:** **${count}** (including this one)`,
    gameOnline && steamKey ? `- **In-game reports on this player:** **${inGameReports}**${syncingToGame ? ' (+1 syncing)' : ''}` : null,
    verdict.summary_en ? `- **AI assessment:** ${verdict.summary_en}` : null,
    '',
    verdict.complaint_ru
      ? `**Жалоба (сформулирована ИИ):**\n${verdict.complaint_ru}`
      : '**Жалоба без ИИ-формулировки — оригинал в канале жалобы.**',
    '',
    `**Чат жалобы:** ${link}`,
    '-# AI triage — final decision is up to staff. Evidence is attached in the complaint channel.',
  ].filter(Boolean);

  if (!log) {
    console.error(`[${channel.guild.name}] Канал приёма жалоб не настроен — запустите /setup-complaints-log в канале администрации.`);
    await channel
      .send('⚠️ Канал администрации для жалоб не настроен — жалоба будет рассмотрена прямо в этом канале.')
      .catch(() => {});
    if (STAFF_ROLE_ID) {
      await channel
        .send({ content: `<@&${STAFF_ROLE_ID}> — жалоба требует рассмотрения.`, allowedMentions: { roles: [STAFF_ROLE_ID] } })
        .catch(() => {});
    }
    return;
  }

  await log.send({ content: lines.join('\n'), allowedMentions: { parse: ['users'], roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : [] } });
  console.log(`[${channel.guild.name}] Жалоба отправлена в «${log.name}» — актуальных жалоб на игрока: ${count}`);
}

function scheduleComplaintTriage(channel, meta, delay = 4000) {
  if (aiTimers.has(channel.id)) clearTimeout(aiTimers.get(channel.id));
  aiTimers.set(
    channel.id,
    setTimeout(() => {
      aiTimers.delete(channel.id);
      runComplaintTriage(channel, meta).catch((err) => console.error(`[AI:жалобы] Сбой триажа: ${err.message}`));
    }, delay)
  );
}

async function runComplaintTriage(channel, metaArg) {
  if (aiBusy.has(channel.id)) {
    scheduleComplaintTriage(channel, metaArg);
    return;
  }
  aiBusy.add(channel.id);
  let meta = metaArg;
  try {
    if (humanTakeover.has(channel.id)) return;
    const fresh = parseChannelTopic(channel.topic);
    if (fresh && fresh.kind === 'complaint') meta = fresh;
    meta = await tryAutoResolveComplaint(channel, meta);
    const history = await buildHistory(channel, meta.userId);
    const candidates = complaintCandidatesFor(meta, history);
    const verdict = await callLLM(buildComplaintSystemPrompt(meta, candidates), history, ['reply', 'submit', 'close']);
    if (humanTakeover.has(channel.id)) {
      console.log(`[AI:жалобы] ${channel.name}: вердикт отброшен — ИИ отключён администрацией.`);
      return;
    }
    console.log(`[AI:жалобы] ${channel.name}: ${verdict.action} — ${verdict.reason}`);
    await applyComplaintVerdict(channel, meta, verdict);
  } catch (err) {
    console.error(`[AI:жалобы] Ошибка триажа (${channel.name}): ${err.message}`);
    humanTakeover.add(channel.id);
    await postComplaintToLog(channel, meta, {
      summary_en: 'AI validation failed — raw complaint forwarded for manual review.',
      complaint_ru: null,
    }).catch(() => {});
    await channel
      .send('Жалоба передана администрации — здесь с вами свяжутся. Прикрепите доказательства, если ещё не сделали этого.')
      .catch(() => {});
  } finally {
    aiBusy.delete(channel.id);
  }
}

async function applyComplaintVerdict(channel, metaArg, verdict) {
  let meta = metaArg;
  if (verdict.resolved) {
    meta = await applyResolvedTarget(channel, meta, verdict.resolved);
  }
  if (verdict.action === 'close') {
    if (idleCloseTimers.has(channel.id)) {
      clearTimeout(idleCloseTimers.get(channel.id));
      idleCloseTimers.delete(channel.id);
    }
    await channel.send(
      `${verdict.reply || 'Жалоба закрыта.'}\n\n-# Если это ошибка — напишите сообщение в ближайшие 20 секунд, и автозакрытие отменится.`
    );
    await channel.send({ components: [ticketClosedPanel(20)], flags: MessageFlags.IsComponentsV2 });
    scheduleChannelClose(channel, 20_000);
  } else if (verdict.action === 'submit') {
    humanTakeover.add(channel.id);
    if (idleCloseTimers.has(channel.id)) {
      clearTimeout(idleCloseTimers.get(channel.id));
      idleCloseTimers.delete(channel.id);
    }
    await postComplaintToLog(channel, meta, verdict);
    await channel.send(verdict.reply || 'Жалоба проверена и передана администрации — с вами свяжутся в этом канале.');
  } else {
    await channel.send(verdict.reply);
    scheduleIdleClose(channel);
  }
}

async function handleSetupComplaints(i) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const message = await i.channel.send({ components: [complaintsPanel()], flags: MessageFlags.IsComponentsV2 });
  let pinned = true;
  try {
    await message.pin();
  } catch {
    pinned = false;
  }
  await i.editReply({
    content: pinned
      ? 'Панель жалоб опубликована и закреплена в этом канале.'
      : 'Панель опубликована, но закрепить не удалось — боту не хватает права «Управлять сообщениями».',
  });
}

async function handleSetupComplaintsLog(i) {
  complaintLogChannels.set(i.guildId, i.channelId);
  saveState();
  const envNote = COMPLAINTS_LOG_CHANNEL_ID
    ? ''
    : '\n-# Надёжнее также задать переменную COMPLAINTS_LOG_CHANNEL_ID на Railway — после редеплоя канал мог сброситься.';
  await i.reply({
    content: `✅ Этот канал назначен каналом приёма жалоб: сюда ИИ будет присылать проверенные жалобы, счётчик актуальных жалоб и ссылку на канал общения.${envNote}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleComplaintOpen(i) {
  const modal = new ModalBuilder().setCustomId('complaint_modal').setTitle('Жалоба на игрока');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('target_nick')
        .setLabel('Ник игрока')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
        .setPlaceholder('Например: SwagPlayer228')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('target_steam')
        .setLabel('Steam ID (SteamID64), если известен')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100)
        .setPlaceholder('76561198…')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Что случилось?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder('Опишите нарушение: когда, где и что произошло')
    )
  );
  await i.showModal(modal);
}

async function handleComplaintModalSubmit(i) {
  const nick = (i.fields.getTextInputValue('target_nick') || '').trim().replace(/\|/g, '/').slice(0, 100);
  const steamRaw = (i.fields.getTextInputValue('target_steam') || '').trim().slice(0, 100);
  const description = (i.fields.getTextInputValue('description') || '').trim().slice(0, 1000);
  if (!nick) {
    await i.reply({ content: 'Укажите ник игрока.', flags: MessageFlags.Ephemeral });
    return;
  }

  await i.deferReply({ flags: MessageFlags.Ephemeral });

  let channels;
  try {
    channels = await i.guild.channels.fetch();
  } catch {
    channels = i.guild.channels.cache;
  }
  const existing = channels.find((c) => (c.topic || '').startsWith(`complaint:${i.user.id}`));
  if (existing) {
    await i.editReply({ content: `У вас уже есть открытая жалоба: ${existing}` });
    return;
  }

  const steamMatch = steamRaw.match(/\d{15,18}/);
  const steamId = steamMatch ? steamMatch[0] : '';
  const key = steamId || nick.toLowerCase();
  const knownPlayer = steamId && gameConnected() ? gameState.players.get(steamId) : null;
  const displayNick = sanitizeGameName(knownPlayer?.name) || nick;
  const display = steamId ? `${displayNick} · ${steamId}` : nick;
  const cleanNick = nick.toLowerCase().replace(/[^a-z0-9а-яё_-]/g, '').slice(0, 20) || 'игрок';

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `жалоба-${cleanNick}`.slice(0, 100),
      type: ChannelType.GuildText,
      topic: `complaint:${i.user.id}|${key}|${display}`,
      parent: TICKET_CATEGORY_ID || undefined,
      permissionOverwrites: buildPrivateOverwrites(i.guild, i.user.id),
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

  await channel.send({ components: [complaintWelcomePanel(i.member, display)], flags: MessageFlags.IsComponentsV2 });
  await channel.send(
    [`**Цель жалобы:** ${display}`, `**От кого:** ${i.member}`, `**Описание:** ${description}`].join('\n')
  );

  let meta = { kind: 'complaint', userId: i.user.id, key, display };
  meta = await tryAutoResolveComplaint(channel, meta).catch(() => meta);
  if (!AI_ENABLED) {
    humanTakeover.add(channel.id);
    await postComplaintToLog(channel, meta, {
      summary_en: 'No AI validation configured — raw complaint forwarded.',
      complaint_ru: null,
    }).catch(() => {});
  } else {
    scheduleComplaintTriage(channel, meta, 20_000);
  }
  console.log(`[${i.guild.name}] Жалоба создана: ${channel.name} (${i.user.tag})`);
  await i.editReply({
    content: `Жалоба создана: ${channel} — прикрепите доказательства (видео или скриншоты) в этот канал, если они есть.`,
  });
}

async function handleGameReports(i) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (!gameConnected()) {
    await i.editReply({
      content: 'Игровой сервер не подключён (нет свежих данных за последние 3 минуты). Проверьте: домен Railway, секрет GAME_API_SECRET и конфиг плагина GlassReportCheck.',
    });
    return;
  }

  const query = i.options.getString('query');
  const matches = findGamePlayers(query, 5);
  if (!matches.length) {
    await i.editReply({
      content: `Игрок «${query}» не найден в базе игрового сервера. Попробуйте точный ник или полный Steam ID.`,
    });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const lines = ['# 📊 Репорты в игре'];
  for (const p of matches) {
    const reports = gameReportsFor(p.id);
    const verifiedUntil = gameState.verified.get(p.id) || 0;
    const onCheck = gameState.activeChecks.find((c) => c.targetId === p.id);
    const status = [
      p.online ? '🟢 В сети' : '⚪ Не в сети',
      verifiedUntil > now ? `✓ Проверен (до <t:${verifiedUntil}:R>)` : null,
      onCheck ? `🔍 На проверке у ${onCheck.moderatorName}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(`### ${p.name} · ${p.id}`, `- ${status}`, `- Актуальных репортов: **${reports.length}**`);
    const latest = [...reports].sort((a, b) => b.unixTime - a.unixTime).slice(0, 5);
    for (const r of latest) {
      lines.push(`- ${r.reason} — от ${r.reporterName} · <t:${r.unixTime}:R>`);
    }
  }
  lines.push('', `-# Данные игры обновлены <t:${Math.floor(gameState.updatedAt / 1000)}:R>`);
  await i.editReply({ content: lines.join('\n') });
}

async function handleGamePlayers(i) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (!gameConnected()) {
    await i.editReply({
      content: 'Игровой сервер не подключён (нет свежих данных за последние 3 минуты). Проверьте: домен Railway, секрет GAME_API_SECRET и конфиг плагина GlassReportCheck.',
    });
    return;
  }

  const query = i.options.getString('query');
  const matches = findGamePlayers(query, 10);
  if (!matches.length) {
    await i.editReply({ content: `По запросу «${query}» игроков не найдено.` });
    return;
  }

  const sorted = matches.sort((a, b) => Number(b.online) - Number(a.online) || (a.name || '').localeCompare(b.name || ''));
  const lines = [
    `# 🎮 Игроки сервера (найдено: ${matches.length})`,
    ...sorted.map(
      (p) =>
        `- **${p.name}** — \`${p.id}\` · ${p.online ? '🟢' : '⚪'} · был в игре <t:${p.lastSeen}:R> · репортов: ${gameReportsFor(p.id).length}`
    ),
    '',
    `-# Данные игры обновлены <t:${Math.floor(gameState.updatedAt / 1000)}:R> · Подробно: /game-reports`,
  ];
  await i.editReply({ content: lines.join('\n') });
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand() && i.commandName === 'setup-tickets') {
      await handleSetupTickets(i);
    } else if (i.isChatInputCommand() && i.commandName === 'ai-off') {
      await handleAIOff(i);
    } else if (i.isChatInputCommand() && i.commandName === 'setup-complaints') {
      await handleSetupComplaints(i);
    } else if (i.isChatInputCommand() && i.commandName === 'setup-complaints-log') {
      await handleSetupComplaintsLog(i);
    } else if (i.isChatInputCommand() && i.commandName === 'game-reports') {
      await handleGameReports(i);
    } else if (i.isChatInputCommand() && i.commandName === 'game-players') {
      await handleGamePlayers(i);
    } else if (i.isButton() && i.customId === 'complaint_open') {
      await handleComplaintOpen(i);
    } else if (i.isModalSubmit() && i.customId === 'complaint_modal') {
      await handleComplaintModalSubmit(i);
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
  const meta = parseChannelTopic(msg.channel.topic);
  if (!meta || msg.author.id !== meta.userId) return;

  if (closeTimers.has(msg.channelId)) {
    clearTimeout(closeTimers.get(msg.channelId));
    closeTimers.delete(msg.channelId);
    await msg.reply({ content: '⏳ Автозакрытие отменено — тикет снова открыт.' }).catch(() => {});
  }
  if (idleCloseTimers.has(msg.channelId)) {
    clearTimeout(idleCloseTimers.get(msg.channelId));
    idleCloseTimers.delete(msg.channelId);
  }

  if (!AI_ENABLED) {
    if (acknowledgedTickets.has(msg.channelId)) return;
    acknowledgedTickets.add(msg.channelId);
    await msg.reply({ content: '✅ Сообщение получено — администрация ответит здесь в ближайшее время.' }).catch(() => {});
    return;
  }

  if (humanTakeover.has(msg.channelId)) return;
  if (meta.kind === 'complaint') {
    scheduleComplaintTriage(msg.channel, meta);
  } else {
    scheduleAITriage(msg.channel, meta);
  }
});

client.on(Events.ChannelDelete, (channel) => {
  for (const map of [closeTimers, aiTimers, idleCloseTimers]) {
    if (map.has(channel.id)) {
      clearTimeout(map.get(channel.id));
      map.delete(channel.id);
    }
  }
  aiBusy.delete(channel.id);
  humanTakeover.delete(channel.id);
  acknowledgedTickets.delete(channel.id);
});

startApiServer();

client.login(TOKEN);
