import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import 'dotenv/config';

const TOKEN = process.env.TOKEN?.trim();
const ROLE_ID = process.env.ROLE_ID?.trim();

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

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

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

client.once(Events.ClientReady, async (c) => {
  console.log(`Бот запущен как ${c.user.tag}`);

  for (const guild of c.guilds.cache.values()) {
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
    console.log(`[${guild.name}] Проверка пройдена. Пропущенным выдана роль: ${fixed}. Жду новых участников.`);
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

client.login(TOKEN);
