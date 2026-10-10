import { Client, Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

const TOKEN = process.env.TOKEN;
const ROLE_ID = process.env.ROLE_ID;

if (!TOKEN) {
  console.error('Ошибка: не указан TOKEN в файле .env');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{50,}$/.test(TOKEN)) {
  console.error('Ошибка: TOKEN в .env выглядит неверным. Скопируйте токен бота из Discord Developer Portal.');
  process.exit(1);
}
if (!ROLE_ID) {
  console.error('Ошибка: не указан ROLE_ID в файле .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Бот запущен как ${c.user.tag}`);

  for (const guild of c.guilds.cache.values()) {
    const role = await guild.roles.fetch(ROLE_ID).catch(() => null);
    if (!role) {
      console.error(`[${guild.name}] Роль ${ROLE_ID} не найдена на сервере.`);
    } else if (role.position >= guild.members.me.roles.highest.position) {
      console.error(
        `[${guild.name}] Роль «${role.name}» стоит выше или на уровне роли бота — опустите её в списке ролей, иначе выдать её нельзя.`
      );
    } else {
      console.log(`[${guild.name}] Роль «${role.name}» найдена, всё готово.`);
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
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
