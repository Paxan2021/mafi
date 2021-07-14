'use strict';
import dotenv from 'dotenv';
import * as functions from './functions.js';
import * as game from './game.js';
import Telegraf from 'telegraf';
import rateLimit from 'telegraf-ratelimit';
dotenv.config();


// Set limit to 75 message per 3 seconds
const limitConfig = {
  window: 3000,
  limit: 75,
  onLimitExceeded: (ctx, next) => ctx.reply('Ограничение скорости превышено')
};

//Создаем обьект бота
export const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
bot.use(rateLimit(limitConfig));
//bot.use(Telegraf.log()); //Выводит сообщение в консоль

//Обработка ошибок
bot.catch((err, ctx) => {
  console.log(`Səhv baş verdi ${ctx.updateType}`, err);
  bot.telegram.sendMessage(process.env.CREATOR_ID, `Səhv baş verdi ${ctx.updateType} Xəta: ${err}`);
});

//Приветствуем пользователя и записываем его на игру, если с командой пришел id чата
bot.start( (ctx) => {
  if (ctx.message.text.length == 6) {
    ctx.reply('Salam, Mən Cəhənnəm oyunu aparıcı botuyam! \nYeni oyun başladmaq üçün /game yazın.');
  } else {
    //Сохраняем в бд пользователя и записываем его на игру
    functions.registrationUserInGame(ctx, ctx.message.text.slice(7));
  }
});


//Выводим подсказку
bot.help((ctx) => {
  ctx.reply('Salam, Mən Cəhənnəm oyunu aparıcı botuyam! \nBotu qrupunuza əlavə edib admin edin \nYeni oyun başladmaq üçün /game yazın.');
});


//Запускаем игру
bot.command('game', async (ctx) => {
  //Если пришло с группового чата, то запускаем регистрацию участников
  if (functions.checkTypeChat(ctx.message.chat.type)) {
    //Проверяем дали ли боту права админа
    if (await functions.checkBotAdmin(ctx.message.chat.id)) {
      if (await functions.checkStartGame(ctx.message.chat.id)) {
          await functions.updateOrAddChatInBD(ctx.message.chat.id, ctx.message.chat.title);
          game.launch(ctx.message.chat.id);
      } else {
        ctx.reply('Oyuna qeydiyyat davam edir!');
      }
    } else {
      ctx.reply('Admin deyiləm!\nMəni admin et!');
    }
  } else {
    ctx.reply('Bu əmr qrup söhbətində göndərilməlidir!');
  }
});

//Запускаем игру
bot.command('role', (ctx) => {
  ctx.reply(`Oyunda aşağıdakı rollar mövcuddur:
👨🏼 <b>İnsan</b> - əsas məqsədi gecə düşməmiş cin və ruhları müəyyən etmək və onları səs verməylə oyundan kənarlaşdırmaqdır.
🕺 <b>Ölümsüz</b> - Gecələr vurulduqda ölməz, ancaq gündüz səs vermədə ölə bilir.
👹 <b>Cin</b> - cəhənnəmin başçısıdır hər gecə bir nəfəri öldürür
👺 <b>Ruh</b> - cinin köməkçisidir gün ərzində oyunçuları səslərindən məhrum edir, Cin ölərsə cəhənnəmin başçısı olur
👨🏼‍⚕️ <b>Həkim</b> - sakinləri yaxşılaşdırır, ancaq ardıcıl 2 dəfə bir oyunçunu sağaldırsa və bir dəfəyə vurulmayıbsa, onu ölümünə qədər sağaldır.
🕵🏼️‍♂️ <b>Komissar</b> - İnsanların başçısı, Cin və Ruhu axtarır, oyunçunu yoxlaya və ya öldürə bilər
👮🏻 <b>Leytenant</b> - komissar köməkçisi, rəis öldükdə rütbə alır və komissar olur
🤦🏼‍♂️ <b>Kamikadze</b> - intiharçıdır, məqsədi günortadan sonra iclasda asılmaqdır
✊ <b>Mühafizəçi</b> - işdən tez ayrıldıqda istənilən oyunçunu əhatə edir, ancaq oyunçunu ölümdən qurtarır.
🔪 <b>Manyak</b> - təkbaşına cinlərlə mübarizə aparmaq istəyir, istənilən sakini öldürə bilər
💃🏻 <b>Məşuqə</b> - gecələr oyunçunun diqqətini yayındırır və hərəkət etmək fürsətini itirir
🧟‍♀ <b>Zombi</b> - məqsədi cin və mülki şəxsləri öldürmək olan şəhərdəki 2 cinayətkar ailənin başçısıdır.
🧘🏻 <b>Dəli</b> - zombinin köməkçisi, oyunçunu komissar və ya mafiya rolunun olub olmadığını yoxlayır, zombi öldükdə yerini alır.
<b>RoBotlarimTg</b> ☑️`, {parse_mode: 'HTML'});
});

//Очищаем данные игры
bot.command('stopgame', (ctx) => {
  game.clearDataGame(ctx.message.chat.id);
});

//Отмечаем всех участников которых знает бот
bot.command('call', (ctx) => {
  functions.callUsers(ctx);
});

//Отправляем статистику пользователя
bot.command('userinfo', (ctx) => {
  functions.getInfoUser(ctx.message.chat.id, ctx.message.from.id);
});

//Отправляем статистику чата
bot.command('chatinfo', (ctx) => {
  functions.getInfoChat(ctx.message.chat.id);
});

//Отправляем топ чата
bot.command('topvictories', (ctx) => {
  functions.topChat(ctx.message.chat.id, 'победителей', 'victories');
});

//Отправляем топ чата
bot.command('topworld', (ctx) => {
  functions.topChat(ctx.message.chat.id, 'Dinc oyunçulardan qalib gələnlər', 'worldVictories');
});

//Отправляем топ чата
bot.command('topcin', (ctx) => {
  functions.topChat(ctx.message.chat.id, 'Cin rolunda qaliblər', 'mafiaVictories');
});

//Отправляем топ чата
bot.command('topzombi', (ctx) => {
  functions.topChat(ctx.message.chat.id, 'Zombi rolunda qaliblər', 'triadaVictories');
});

//При добавлении пользователя запоминаем его данные
bot.on('new_chat_members', (ctx) => {
  if (functions.checkTypeChat(ctx.message.chat.type)) {
    functions.checkingLoggedUser(ctx.message.chat.id, ctx.message.new_chat_members);
  } else {
    functions.leaveChat(ctx.message.chat.id);
  }
});


//При выходе участника удаляем его из бд
bot.on('left_chat_member', (ctx) => {
  functions.leftUserOrChat(ctx.message.chat.id, ctx.message.left_chat_member);
});


//Ловим изменение типа чата и его айди
bot.on('migrate_to_chat_id', (ctx) => {
  functions.autoUpdateIDChat(ctx.message.chat.id, ctx.message.migrate_to_chat_id);
});


//Ловим изменение имени чата
bot.on('new_chat_title', (ctx) => {
  functions.autoUpdateTitleChat(ctx.message.chat.id, ctx.message.chat.title);
});


//Ловим колбеки от кнопок
bot.on('callback_query', (ctx) => {
  game.callbackQuery(ctx);
});


//Удаляем сообщение, если ночь или убит
bot.on('message', (ctx) => {
  if (functions.checkTypeChat(ctx.message.chat.type)) {
    game.closeWriteChat(ctx);
  }
});


//Запускаем бесконечный цикл полинга
bot.launch();
