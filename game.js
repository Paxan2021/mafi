'use strict';
import * as keyboards from './keyboards.js';
import * as app from './app.js';
import * as dq from './database-queries.js';
import * as functions from './functions.js';


//Запуск регистрации и игры
export async function launch(ChatID) {
    await dq.updateDataClearDataGame(ChatID);
    await registration(ChatID); //Зарегистрировали игроков
    await dq.updateDataStartGame(ChatID, Date.now()); //Закрыли регистрацию и записали время начала игры
    const data = await dq.getDataGame(ChatID);//Получаем записавшихся человек
    if (data.dataGame.counterPlayers > 3) {
        await app.bot.telegram.sendMessage(ChatID, 'Cəhənnəmdə yeni bir oyun başladı 🔥');
        const masRoles = await creatingRoles(ChatID, data.dataGame.counterPlayers); //Получаем массив ролей
        await distributionOfRoles(ChatID, masRoles, data.players); //Раздаю роли игрокам
        await sendRoleMessage(ChatID); //Отправляем сообщение с ролью и описанием
        let continueGame = true;
        while(continueGame) {
            const data = await dq.getDataGame(ChatID);
            console.log('Günün dəyişməsi', data);

            if (data.dataGame.statysDay) {
                await day(ChatID, data); //Наступает день
            } else {
                await night(ChatID, data); //Наступает ночь
            }
            continueGame = await checkingTheEndOfTheGame(ChatID); //Проверяем нужно ли продолжить игру
        }
    } else {//Отправляем сообщение что недостаточно игроков и очищаем данные
        const dataMessageID = await dq.getDataDeleteMessageRegistration(ChatID);
        if (dataMessageID.messageID != 0 ) {
            await app.bot.telegram.sendMessage(
                ChatID,
                'Yetərli oyunçu yoxdu, oyun ləğv edildi !'
            );
        }
    }
    await dq.updateDataClearDataGame(ChatID);
}


//Редактируем сообщение регистрации
export async function updateMessageRegistration(chatID) {
    const data = await dq.getDataUpdateMessageRegistration(chatID);
    let textMessage = `Oyun ${data.registrationTimeLeft} saniyəyə başlayır! \nOyunçular:` + await getLifeUsersText(chatID);
    app.bot.telegram.editMessageText(
        chatID,
        data.messageID,
        null,
        textMessage,
        {
        parse_mode: 'HTML',
        reply_markup: keyboards.userRegistrationBtn(process.env.URL_BOT, chatID)
        }
    );
}


//Очищаем данные игры и останавливаем игру
export async function clearDataGame(chatID) {
    const dataMessageID = await dq.getDataDeleteMessageRegistration(chatID);
    try {
        if (dataMessageID != 0) {
        await app.bot.telegram.deleteMessage(chatID, dataMessageID.messageID);
        }
    }
    finally  {
        await dq.updateDataClearDataGame(chatID);
        await app.bot.telegram.sendMessage(
            chatID,
            'Oyun dayandırıldı!'
        );
    }
}


//Закрытие чата для всех кто не живой
export async function closeWriteChat(ctx) {
    const data = await dq.getDataCloseWriteChat(ctx.message.chat.id);

    if (data != null && data.dataGame.counterDays != 0) {
        if (ctx.message.document == undefined || ctx.message.photo == undefined) {
            if (data.dataGame.statysDay) {
                let DeleteMessage = true;
                for (const item of data.players) {
                    if (item.userID == ctx.message.from.id && (item.lifeStatus || item.dyingMessage)) {
                        DeleteMessage = false;
                        if (item.dyingMessage) {
                            await dq.updateDyingMessage(ctx.message.chat.id, ctx.message.from.id);
                        }
                    }
                }
                if (DeleteMessage) {
                    ctx.deleteMessage();
                }
            } else {
                ctx.deleteMessage();
            }
        } else {
            ctx.deleteMessage();
        }
    }
}

//Создаем массив с ролями и записываем в бд сколько у нас из какого клана
async function creatingRoles(chatID, counter) {
    let masRoles, counterWorld = 0, counterMafia = 2, counterTriada = 0;
    if (counter <5) {
        masRoles = ['Cin', 'Həkim', 'Ölümsüz']; //2
        counterWorld = 2;
        counterMafia = 1;
    } else if (counter <7) {
        masRoles = ['Cin', 'Həkim', 'Komissar', 'Ölümsüz'];//2
        counterWorld = 3;
    } else if (counter <9) {
        masRoles = ['Cin', 'Ruh', 'Həkim', 'Komissar', 'Ölümsüz', 'Kamikadze'];//3
        counterWorld = 4;
    } else if (counter <10) {
        masRoles = [
            'Cin', 'Ruh', 'Həkim', 'Komissar', 'Ölümsüz', 'Kamikadze', 
            'Mühafizəçi', 'Manyak'
        ];//2
        counterWorld = 6;
    } else if (counter <11) {
        masRoles = [
            'Cin', 'Ruh', 'Həkim', 'Komissar', 'Ölümsüz', 'Kamikadze', 
            'Mühafizəçi', 'Manyak', 'Məşuqə'
        ];//2
        counterWorld = 7;
    } else if (counter <13) {
        masRoles = [
            'Cin', 'Ruh', 'Həkim', 'Komissar', 'Leytenant', 'Ölümsüz', 
            'Kamikadze', 'Mühafizəçi', 'Manyak', 'Məşuqə'
        ];//3
        counterWorld = 8;
    } else if (counter <15) {
        masRoles = [
            'Cin', 'Ruh', 'Həkim', 'Komissar', 'Leytenant', 'Ölümsüz', 
            'Kamikadze', 'Mühafizəçi', 'Manyak', 'Manyak', 'Zombi'
        ];//4
        counterWorld = 8;
        counterTriada = 1;
    } else if (counter <19) {
        masRoles = [
            'Cin', 'Ruh', 'Həkim', 'Komissar', 'Leytenant', 'Ölümsüz', 
            'Kamikadze', 'Mühafizəçi', 'Manyak', 'Məşuqə', 'Zombi', 'Dəli'
        ];//7
        counterWorld = 8;
        counterTriada = 2;
    }
    const WorldPlayer = counter-masRoles.length;
    if (WorldPlayer != 0) {
        for (let i = 0; i < WorldPlayer ; i++) {
            masRoles.push('İnsan');
            counterWorld+=1;
        }
    }
    await dq.updateCounterRolesGame(chatID, counterWorld, counterMafia, counterTriada);   ///Тут может не работать ибо я не дожидаюсь завершения асинхронной функции
    return mixingMas(masRoles);
}

//Присваиваем роли игрокам
function distributionOfRoles(ChatID, masRoles, masPlayers) {
    masPlayers.forEach((item, i) => {
        let allies = 0;
        if (masRoles[i] == 'Komissar' || masRoles[i] == 'Leytenant') {
            allies = 1;
        } else if (masRoles[i] == 'Cin' || masRoles[i] == 'Ruh') {
            allies = 2;
        } else if (masRoles[i] == 'Zombi' || masRoles[i] == 'Dəli') {
            allies = 3;
        }
        dq.addRolePlayer(ChatID, item.userID, masRoles[i], allies);
    });
}

//Перемешиваем массив с ролями
function mixingMas(arr) {
    let tmp, randindex;
    const length  = arr.length;
    for (let j = 0; j < 3 ; j++) {
        for (let i = 0; i < length ; i++) {
            randindex = getRandomInt(0, length);
            tmp = arr[i];
            arr[i] = arr[randindex];
            arr[randindex] = tmp;
        }
    }
    return arr;
}

//Получение рандомного числа в диапазоне
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Максимум не включается, минимум включается
}

//Наступление ночи
async function night(ChatID, data) {
    await dq.clearCounterActiveRoles(ChatID); //Очищаем счетчик активных ролей
    await sendNightMessage(ChatID); //Отправили гифку с наступлением ночи
    await sendNightMessageLivePlayers(ChatID); //Отправляем сообщение с живыми игроками
    await sendNightMessageActionsLivePlayers(ChatID, data);//Отправляем сообщение с кнопками для действий
    for (let i = 0; i < 12; i++) { //Ждем минуту или пока все активные роли не проголосуют
        await delay(5000);
        const data = await dq.getDataCounterActiveRoles(ChatID);
        if (data.dataGame.counterActiveRoles == 0){
            break;
        }
    }
    let newData = await dq.getDataGame(ChatID);
    await ProcessingResultsNight(newData, ChatID); //Обрабатываем результаты ночи и перезаписываем данные
}

//Наступление дня
async function day(ChatID, data) {
    const i = data.dataGame.counterDays/2;
    await deleteMessageAct(data, ChatID); //Удаляем сообщения на которые пользователь не нажимал ночью
    await sendSunMessage(ChatID, i); //Отправили гифку с наступлением дня
    await sendDayMessageLivePlayers(ChatID, data); //Отправляем сообщение с живыми игроками
    await delay(45000); //Ждем 45 секунд
    await sendMessageVote(ChatID, data.players);//Отправляем голосовалку
    await delay(45000);// Ждем 45 секунд
    await ProcessingResultsDay(ChatID);
    await dq.updateStatusDay(ChatID, false);
}

//Отправляем сообщение с дневным голосованием
async function sendMessageVote(ChatID, players) {
    for (const player of players) {
        if (player.lifeStatus && player.votes) {
            const messageData = await app.bot.telegram.sendMessage(
                player.userID,
                'Günahkarı axtarmağın vaxtı gəldi!\nKimi linç etmək istəyirsən?',
                {
                    parse_mode: 'HTML',
                    reply_markup: keyboards.buttonActionsDay(ChatID, players, player.userID)
                }
            );
            await dq.updateMessageIDPlayer(ChatID, messageData.message_id, player.userID);
        }
    }
}

//Удаляем сообщения если пользователь не выбрал действие
async function deleteMessageAct(data, ChatID) {
    for (const player of data.players) {
        if (player.messageID != 0) {
            await app.bot.telegram.deleteMessage(player.userID, player.messageID);
        }
        await dq.clearMessageIDPlayers(ChatID, player.userID);
    }
}

//Отправляем сообщение в чат о том что игрок сделал ход
async function sendMessageAboutProgressRole(ChatID, userID, actUserID) {
    const user = await dq.getInfoPlayer(ChatID, userID),
          userAct = await dq.getInfoPlayer(ChatID, actUserID);
    let textMessage = '',
        textMessageUser = '';
    switch(user.players[0].role){
        case 'Cin':
            textMessage = '👹 <b>Cin</b> kiməsə yaxınlaşır...';
            textMessageUser = `Sənin seçimin<a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Ruh':
            textMessage = '👺 <b>Ruh</b> bir oyunçunu cəhənnəmin dibinə çəkdi...';
            textMessageUser = `Sənin seçimin <a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Həkim':
            textMessage = '👨🏼‍⚕️ <b>Həkim</b> kimisə sağaltmağa çalışır...';
            textMessageUser = `Sənin seçimin <a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Komissar':
            if (user.players[0].copCheck){
                textMessage = '🕵🏼️‍♂️ <b>Komissar</b> cini axtarmağa getdi...';
                textMessageUser = `Sənin seçimin <a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            } else {
                textMessage = '🕵🏼️‍♂️ <b>Komissar</b> silahını bir nəfərə tutdu...';
                textMessageUser = `Sənin seçimin<a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            }
            break;
        case 'Mühafizəçi':
            textMessage = '✊ <b>Mühafizəçi</b> öz həyatını təhlükəyə atdı..';
            textMessageUser = `Sənin seçimin <a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Manyak':
            textMessage = '🔪 <b>Manyak</b> kimisə bıçaqladı...';
            textMessageUser = `Sənin seçimin<a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Məşuqə':
            textMessage = '💃🏻 <b>Məşuqə</b> kiminsə qonağı oldu...';
            textMessageUser = `Sənin seçimin<a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Zombi':
            textMessage = '🧟‍♀ <b>Zombi</b> qurbanını seçdi...';
            textMessageUser = `Sənin seçimin <a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
        case 'Dəli':
            textMessage = '🤡 <b>Dəli</b> ortalıqda gəzir...';
            textMessageUser = `Sənin seçimin <a href="tg://user?id=${userAct.players[0].userID}">${userAct.players[0].name}</a>`;
            break;
    }
    if (textMessage !== '') {
        app.bot.telegram.sendMessage(
            ChatID,
            textMessage,
            { parse_mode: 'HTML' }
        );
        app.bot.telegram.sendMessage(
            userID,
            textMessageUser,
            { parse_mode: 'HTML' }
        );
    }
}

//Отправляем сообщение кто за кого голосовал
async function sendMessageVoiceUserInChat(ChatID, userID, userIDAct) {
    const user = await dq.getInfoPlayer(ChatID, userID),
          userAct = await dq.getInfoPlayer(ChatID, userIDAct);
    app.bot.telegram.sendMessage(
        ChatID,
        `<a href="tg://user?id=${userID}">${user.players[0].name}</a> `+
        `səs verdi: <a href="tg://user?id=${userIDAct}">${userAct.players[0].name}</a>`,
        { parse_mode: 'HTML' }
    );
}

//Проверка на наличие победителей
async function checkingTheEndOfTheGame(ChatID) {
    let data = await dq.getDataGame(ChatID);
    let continueGame = true;
    let won = 0;
    if (data.dataGame.timeStart != 0) {
        if (data.dataGame.inactivePlay != 0) {
            if (!data.dataGame.statysDay) { // конец дня
                if (data.dataGame.counterMafia === 0 && data.dataGame.counterTriada === 0) {
                    won = 1;
                } else if (data.dataGame.counterWorld === 0 && data.dataGame.counterTriada === 0) {
                    won = 2;
                } else if (data.dataGame.counterMafia === 0 && data.dataGame.counterWorld === 0) {
                    won = 3;
                }
                //Если остался 1 мирный и кто то из мафии или триады то победили те
            } else { //Конец ночи
                if (data.dataGame.counterWorld === 0 && data.dataGame.counterMafia === 0 && data.dataGame.counterTriada === 0) {
                    continueGame = false;
                    app.bot.telegram.sendMessage(
                        ChatID,
                        'Bütün oyunçular öldü - qalib yoxdur'
                    );
                } else if (data.dataGame.counterMafia === 0 && data.dataGame.counterTriada === 0) {
                    won = 1;
                } else if (data.dataGame.counterWorld <= 1 && data.dataGame.counterMafia > 0 && data.dataGame.counterTriada === 0) {
                    won = 2;
                } else if (data.dataGame.counterWorld <= 1 && data.dataGame.counterTriada > 0 && data.dataGame.counterMafia === 0) {
                    won = 3;
                }
            }
            if (won !=0) {
                continueGame = false;
                await sendMessageGameEnd(ChatID, won, data);
            }
        } else {
            continueGame = false;
            app.bot.telegram.sendMessage(
                ChatID,
                'Uzun müddətdir heç bir fəaliyyət yoxdur, oyun bitdi!'
            );
        }
        return continueGame;
    }
    return false;
}

//Отправляем сообщение о завершении игры
async function sendMessageGameEnd(ChatID, won, data) {
    let textMessage = `<b>Oyun Bitdi!</b>\nQaliblər`;
    let textEndMessage = ``;
    switch (won) {
        case 1:
            textMessage += `и: İnsan\n\nQaliblər:`;
            for (const player of data.players) {
                if (player.lifeStatus || player.suicide) {
                    textMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addWorldVictoryPlayer(ChatID, player.userID);
                } else if (player.suicide) {
                    textMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addWorldVictoryPlayer(ChatID, player.userID);
                } else {
                    textEndMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addCounterGamePlayer(ChatID, player.userID);
                }
            }
            await dq.addWorldVictoryChat(ChatID);
            break;
        case 2:
            textMessage += `Cinlər\n\nQalibdir:`;
            for (const player of data.players) {
                if (player.lifeStatus && (player.initialRole == 'Cin' || player.initialRole == 'Ruh')) {
                    textMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addMafiaVictoryPlayer(ChatID, player.userID);
                } else if (player.suicide) {
                    textMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addWorldVictoryPlayer(ChatID, player.userID);
                } else {
                    textEndMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addCounterGamePlayer(ChatID, player.userID);
                }
            }
            await dq.addMafiaVictoryChat(ChatID);
            break;
        case 3:
            textMessage += `Zombi\n\nQalibdir:`;
            for (const player of data.players) {
                if (player.lifeStatus && (player.initialRole == 'Zombi' || player.initialRole == 'Dəli')) {
                    textMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addTriadaVictoryPlayer(ChatID, player.userID);
                } else if (player.suicide) {
                    textMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addWorldVictoryPlayer(ChatID, player.userID);
                } else {
                    textEndMessage+=`\n  <a href="tg://user?id=${player.userID}">${player.name}</a> - <b>${player.initialRole}</b>`;
                    await dq.addCounterGamePlayer(ChatID, player.userID);
                }
            }
            await dq.addTriadaVictoryChat(ChatID);
            break;
    }
    textMessage+=`\n\nQalan iştirakçılar:`+textEndMessage+`\n\nOyun müddəti: `+convertTimeToText(data.dataGame.timeStart);
    await app.bot.telegram.sendMessage(
        ChatID,
        textMessage,
        {
            parse_mode: 'HTML',
            reply_markup: keyboards.newGame()
        }
    );
}

//Отправляем гифку сначалом ночи
async function sendNightMessage(ChatID) {
    await app.bot.telegram.sendAnimation(
        ChatID,
        'https://media.tenor.com/images/286ae769ba034e724ce706d371df374d/tenor.gif',
        {
          parse_mode: 'HTML',
          caption: '🌃 <b>Gecə düşür</b> Yalnız cəsarətlilər və qorxmazlar cəhənnəmdə görsənir. Səhər başlarını saymağa çalışacağıq...',
          reply_markup: keyboards.goToBot(process.env.URL_BOT)
        }
    );
}

//Отправляем список живых игроков для ночи
async function sendNightMessageLivePlayers(ChatID) {
    await app.bot.telegram.sendMessage(
        ChatID,
        `<b>Cəhənnəmdə sağ qalanlar: </b>`+await getLifeUsersText(ChatID)+`\n\nYuxu vaxtı <b>1 dəq.</b>`,
        { parse_mode: 'HTML' }
    );
}

//Отправляем сообщения с ролями игроков
async function sendRoleMessage(ChatID) {
    const data = await dq.getDataGame(ChatID);
    for (let player of data.players) {
        const textMessage = await createTextMessageRoles(player.role);
        await app.bot.telegram.sendMessage(
            player.userID,
            textMessage,
            { parse_mode: 'HTML' }
        );
    }
}

//Формируем текст сообщения с описанием роли
function createTextMessageRoles(role) {
    let textMessage = 'Siz əgər bu mesajı görürsünüzsə zəhmət olmasa onu @aykhan_s -ə yönləndirin';
    switch(role) {
        case 'İnsan':
            textMessage = 'Rolun - 👨🏼 <b>İnsan</b>.\nƏsas məqsədi gecə düşməmiş cin və ruhu müəyyən etmək və onları səs verməylə oyundan kənarlaşdırmaqdır';
            break;
        case 'Cin':
            textMessage = 'Rolun - 👹 <b>Cin</b>.\nCəhənnəm onun əlindədir hər gecə bir nəfəri öldürür...';
            break;
        case 'Ruh':
            textMessage = 'Rolun - 👺 <b>Ruh</b>.\nCinin köməkçisidir gün ərzində oyunçuları səslərindən məhrum edir, Cin ölərsə onun yerinə keçir.';
            break;
        case 'Həkim':
            textMessage = 'Rolun - 👨🏼‍⚕️ <b>Həkim</b>.\nsakinləri yaxşılaşdırır, ancaq ardıcıl 2 dəfə bir oyunçunu sağaldırsa və bir dəfəyə vurulmayıbsa, onu ölümünə qədər sağaldır...';
            break;
        case 'Komissar':
            textMessage = 'Rolun - 🕵🏼️‍♂️ <b>Komissar</b>.\nİnsanların başçısı, Cin və Ruhu axtarır, oyunçunu yoxlaya və ya öldürə bilər...';
            break;
        case 'Leytenant':
            textMessage = 'Rolun - 👮🏻 <b>Leytenant</b>.\nKomissar köməkçisi, rəis öldükdə rütbə alır və komissar olur';
            break;
        case 'Ölümsüz':
            textMessage = 'Rolun - 🕺 <b>Ölümsüz insan</b>.\nSən Ölümsüzsən. Geceler vurulduqda ölmürsən, yalnız gündüz səs vermədə asıla bilirsən.';
            break;
        case 'Kamikadze':
            textMessage = 'Rolun - 🤦🏼‍♂️ <b>Kamikadze</b>.\nintiharçıdır, məqsədi günortadan sonra iclasda asılmaqdır :)';
            break;
        case 'Mühafizəçi':
            textMessage = 'Rolun - ✊ <b>Mühafizəçi</b>.\nİşdən tez ayrıldıqda istənilən oyunçunu əhatə edir, ancaq oyunçunu ölümdən qurtarır...';
            break;
        case 'Manyak':
            textMessage = 'Rolun - 🔪 <b>Manyak</b>.\nTəkbaşına mafiya ilə mübarizə aparmaq istəyir, istənilən insanı öldürə bilər...';
            break;
        case 'Məşuqə':
            textMessage = 'Rolun - 💃🏻 <b>Məşuqə</b>.\nGecələr oyunçunun diqqətini yayındırır və hərəkət etmək fürsətini itirir...';
            break;
        case 'Zombi':
            textMessage = 'Rolun - 🧟‍♀ <b>Zombi</b>.\nMəqsədi mafiya və mülki şəxsləri öldürmək olan şəhərdəki 2 cinayətkar ailənin başçısıdır...';
            break;
        case 'Dəli':
            textMessage = 'Rolun - 🤡 <b>Dəli</b>.\nzZombinin köməkçisi, oyunçunu komissar və ya mafiya rolunun olub olmadığını yoxlayır, zombi öldükdə yerini alır...';
            break;
    }
    return textMessage;
}

//Формируем текст сообщения с действием
async function createTextMessageAction(role, userID, ChatID) {
    let textMessage = '';
    switch(role) {
        case 'Cin':
        case 'Manyak':
        case 'Zombi':
            textMessage = 'Bu gecə kimi öldürəcəyik?';
            break;
        case 'Ruh':
            textMessage = 'Gün ərzində kimi səsvermə hüququndan məhrum edəcəyik?';
            break;
        case 'Həkim':
            textMessage = 'Kimə müalicə edəcəyik?';
            break;
        case 'Komissar':
            const messageData = await app.bot.telegram.sendMessage(
                userID,
                'Nə edirik?',
                { reply_markup: keyboards.checkOrKill(ChatID) }
            );
            await dq.updateMessageIDPlayer(ChatID, messageData.message_id, userID);
            break;
        case 'Mühafizəçi':
            textMessage = 'Bu gecə kimləri qoruyacağıq?';
            break;
        case 'Məşuqə':
            textMessage = 'Bu gecə kimə gedək?';
            break;
        case 'Dəli':
            textMessage = 'Kimi yoxlayaq?';
            break;
    }
    return textMessage;
}

//Отправляем сообщение с действиями для активных ролей
async function sendNightMessageActionsLivePlayers(ChatID, data) {
    for (let player of data.players) {
        if (player.lifeStatus) {
            let textMessage = await createTextMessageAction(player.role, player.userID, ChatID);
            if (textMessage != '') {
                await dq.updateDataCounterActiveRoles(ChatID, true);
                const messageData = await app.bot.telegram.sendMessage(
                    player.userID,
                    textMessage,
                    { reply_markup: keyboards.buttonActionsNight(ChatID, data.players, player.userID, player.allies) }
                );
                await dq.updateMessageIDPlayer(ChatID, messageData.message_id, player.userID);
            }
        }
    }
}

//Обрабатываем результаты ночи
async function ProcessingResultsNight(data, ChatID) {
    let trigerAction = 0,
        kill = 0,
        Lucky = false;
    let cloneData = JSON.parse(JSON.stringify(data));
    cloneData.dataGame.statysDay = true;
    //Очищаем действия у того, к кому сходила красотка
    if (data.dataGame.counterPlayers >= 10) {
        data.players.forEach((player, i) => {
            if (player.lifeStatus && player.role == 'Məşuqə' && player.actID != 0) {
                const actID = player.actID;
                cloneData.players[i].actID = 0;
                data.players.forEach((player, i) => {
                    if (player.userID == actID) {
                        cloneData.players[i].actID = 0;
                        data.players[i].actID = 0;
                        trigerAction += 1;
                        app.bot.telegram.sendMessage(
                            player.userID, 
                            'Məşuqə sənin qonağın oldu...');
                    }
                });
            }
        });
    }
    //Стреляем по игрокам и проверяем их
    data.players.forEach((player, i) => {
        if ((player.lifeStatus && player.role == 'Cin' && player.actID != 0)||
            (player.lifeStatus && player.role == 'Komissar' && player.actID != 0 && !player.copCheck)||
            (player.lifeStatus && player.role == 'Мanyak' && player.actID != 0)||
            (player.lifeStatus && player.role == 'Zombi' && player.actID != 0)) {

            const actID = player.actID;
            cloneData.players[i].actID = 0;
            data.players.forEach((player, i) => {
                if (player.userID == actID) {
                    cloneData.players[i].lifeStatus = false;
                    cloneData.players[i].dyingMessage = true;
                    cloneData.players[i].therapyDay = 0;
                    cloneData = updateCounter(cloneData, i, true);
                    data.players[i].therapyDay = 0;
                    trigerAction += 1;
                    app.bot.telegram.sendMessage(
                        player.userID,
                        'Sizi öldürdülər :(');
                }
            });
        } else if ((player.lifeStatus && player.role == 'Komissar' && player.actID != 0 && player.copCheck)||
                   (player.lifeStatus && player.role == 'Dəli' && player.actID != 0)||
                   (player.lifeStatus && player.role == 'Ruh' && player.actID != 0)) {
            const actID = player.actID,
                  checkingID = player.userID,
                  role = player.role;

            cloneData.players[i].actID = 0;
            data.players.forEach((player, i) => {
                if (player.userID == actID) {
                    trigerAction += 1;
                    if (role == 'Ruh') {
                        cloneData.players[i].votes = false;
                        app.bot.telegram.sendMessage(
                            player.userID,
                            'Şəhər xaricindəsiniz və gündüz iclasında iştirak edə bilməzsiniz...');
                    } else {
                        app.bot.telegram.sendMessage(
                            player.userID,
                            'Kimsə sənin rolunu öyrəndi...');
                    }
                    if (role == 'Komissar') {
                        app.bot.telegram.sendMessage(
                            checkingID,
                            `${player.name} - ${player.role}`);
                    } else if (role == 'Dəli') {
                        if (player.role == 'Komissar' || 
                            player.role == 'Leytenant'|| 
                            player.role == 'Cin'|| 
                            player.role == 'Ruh') {

                            app.bot.telegram.sendMessage(
                                checkingID,
                                `${player.name} - ${player.role}`);
                        } else {
                            app.bot.telegram.sendMessage(
                                checkingID,
                                `${player.name} - İnsan`);
                        }
                    }
                }
            });
        }
    });
    //Оживляем или убиваем игроков
    data.players.forEach((player, i) => {
        if (player.lifeStatus && player.role == 'Həkim' && player.actID != 0) {
        
            const actID = player.actID,
                  index = i;
            cloneData.players[i].actID = 0;
            trigerAction += 1;

            cloneData.players.forEach((player, i) => {
                if (player.userID == actID) {
                    if (player.lifeStatus) {
                        if (player.therapyDay == cloneData.dataGame.counterDays -2 ) {
                            cloneData.players[i].lifeStatus = false;
                            cloneData.players[i].dyingMessage = true;
                            cloneData = updateCounter(cloneData, i, true);
                            app.bot.telegram.sendMessage(
                            player.userID,
                            'Həkim daha çox həb gətirdi və dozasını aşdınız... '+
                            'Oyunla söhbətdə həkimə "təşəkkür edirəm" deyə bilərsiniz');
                        } else {
                            cloneData.players[i].therapyDay = cloneData.dataGame.counterDays;
                            app.bot.telegram.sendMessage(
                            player.userID,
                            'Başınız ağrıyırdı və həkim sizə bir həb verdi...');
                        }
                    } else {
                        cloneData.players[i].lifeStatus = true;
                        cloneData.players[i].therapyDay = 0;
                        cloneData = updateCounter(cloneData, i, false);
                        app.bot.telegram.sendMessage(
                            player.userID,
                            'Sizi vurdular, ama Həkim sizi sağaltdı...');
                    }
                }
            });
        }
    });
    //Cпасаем игроков
    data.players.forEach((player, i) => {
        if (player.lifeStatus && player.role == 'Mühafizəçi' && player.actID != 0) {
            const actID = player.actID,
                  index = i;

            cloneData.players[i].actID = 0;
            trigerAction += 1;
            cloneData.players.forEach((player, i) => {
                if (player.userID == actID) {
                    if (player.lifeStatus) {
                        app.bot.telegram.sendMessage(
                            player.userID,
                            'Mühafizə səni bütün gecə qorudu, amma hücum olmadı...');
                    } else {
                        cloneData.players[index].role = 'İnsan';
                        cloneData.players[i].lifeStatus = true;
                        cloneData = updateCounter(cloneData, i, false);
                        app.bot.telegram.sendMessage(
                            player.userID,
                            'Sizi vururdular, ancaq mühafizəçi sizi xilas etdi və yaralandı...');
                        app.bot.telegram.sendMessage(
                            cloneData.players[index].userID,
                            'Bir kəndlini xilas etdin, ancaq yaralandın və artıq mühafizəçi kimi işləyə bilməzsən...');
                    }
                }
            });
        }
    });
    //Проверяем были ли действия ночью
    if (trigerAction === 0) {
        await dq.updateDataInactivePlay(ChatID); //не было действий
    } else {
        cloneData.dataGame.inactivePlay = 5;
        //Отправляем в чат информацию, если кого-то убили
        cloneData.players.forEach((player, i) => {
            if (!player.lifeStatus && data.players[i].lifeStatus) {
                kill += 9;
                if (player.initialRole == 'Ölümsüz'){
                    if (Math.random() > 0.65){
                        cloneData.players[i].lifeStatus = true;
                        cloneData = updateCounter(cloneData, i, false);
                        kill -= 1;
                        Lucky = false;
                        app.bot.telegram.sendMessage(
                            ChatID,
                            `Bu axşam insanlardan bəzilərinə qismət oldu...`);
                        app.bot.telegram.sendMessage(
                            player.userID,
                            `Bu gecə sizin üçün şanslı və möcüzəvi şəkildə dirildi...`);
                    } else {
                        app.bot.telegram.sendMessage(
                            ChatID,
                            `Bu gecə ${player.name} öldürüldü, o ${player.role} idi`);
                    }
                } else {
                    app.bot.telegram.sendMessage(
                        ChatID,
                        `Bu gecə ${player.name} öldürüldü, o ${player.role} idi`);
                }
                if (player.initialRole == 'Cin') {
                    cloneData.players.forEach((player, i) => {
                        if (player.lifeStatus && player.role == 'Ruh') {
                            app.bot.telegram.sendMessage(
                                ChatID,
                                'Cin öldü, Ruh rolunu dəyişib Cin oldu!');
                            cloneData.players[i].role = 'Cin';
                        }
                    });
                } else if (player.initialRole == 'Komissar') {
                    cloneData.players.forEach((player, i) => {
                        if (player.lifeStatus && player.role == 'Leytenant') {
                            app.bot.telegram.sendMessage(
                                player.userID,
                                'Komissar öldü, insanların başçısı sənsən!');
                            cloneData.players[i].role = 'Komissar';
                        }
                    });
                } else if (player.initialRole == 'Zombi') {
                    cloneData.players.forEach((player, i) => {
                        if (player.lifeStatus && player.role == 'Dəli') {
                            app.bot.telegram.sendMessage(
                                ChatID,
                                'Zombi öldü, artıq bütün məsuliyyət sənin üzərindədir!');
                            cloneData.players[i].role = 'Zombi';
                        }
                    });
                }
            }
        });
        cloneData.dataGame.counterDays += 1;
        await dq.updateDataGame(ChatID, cloneData.dataGame, cloneData.players); //Перезаписываем данные игры
        if (kill == 0 && !Lucky) {
            app.bot.telegram.sendMessage(
                ChatID,
                'Bu gecə heçkim ölmədi...');
        }
    }
}

//Обрабатываем результаты дня
async function ProcessingResultsDay(ChatID) {
    const data = await dq.getDataGame(ChatID); //Получаю данные голосования
    let maxVoice = 0,
        counter = 0,
        userNumber;
    await deleteMessageAct(data, ChatID); //Удаляем сообщения на которые пользователь не нажимал
    data.players.forEach((player) => {
        if (player.lifeStatus && player.votesAgainst > maxVoice) {
            maxVoice = player.votesAgainst;
        }
    });
    data.players.forEach((player, i) => {
        if (player.lifeStatus && player.votesAgainst == maxVoice) {
            counter += 1;
            userNumber = i;
        }
        dq.clearVoticeDay(ChatID, player.userID);
    });
    if (counter == 1){
        const message = await app.bot.telegram.sendMessage(
            ChatID,
            `İnsanlar <a href="tg://user?id=${data.players[userNumber].userID}">${data.players[userNumber].name} Cin olduğunu düşünürlər, öldürmək istəyirsiniz?</a>?`,
            {
              parse_mode: 'HTML',
              reply_markup: keyboards.voteYesNoDay(data.players[userNumber].userID, 0, 0)
            }
        );
        await delay(30000);
        await app.bot.telegram.deleteMessage(ChatID, message.message_id);
        //Отправляем сообщение с кнопками для повешанья в чат и записываем его айди, после таймера удалим его, в базу заносить не нужно
        const newData = await dq.getDataPlayers(ChatID);
        if (newData.players[userNumber].votesAgainst > newData.players[userNumber].votesFor) {
            await dq.suspendPlayer(ChatID, newData.players[userNumber].userID); //Вешаем игрока
            if (newData.players[userNumber].initialRole == ('Zombi'||'Dəli')) {
                dq.decrementCounterTriada(ChatID);
            } else if (newData.players[userNumber].initialRole == ('Cin'||'Ruh')) {
                dq.decrementCounterMafia(ChatID);
            } else {
                dq.decrementCounterWorld(ChatID);
            }
            await app.bot.telegram.sendMessage(
                ChatID,
                `Səhər görüşündə asıldı - <a href="tg://user?id=${newData.players[userNumber].userID}">`+
                `${newData.players[userNumber].name}</a> - ${newData.players[userNumber].role}`,
                { parse_mode: 'HTML' }
            );
        } else {
            await app.bot.telegram.sendMessage(
                ChatID,
                `İnsanların fikirləri fərqli oldu, bu gecə heç kimi asmadılar..`
            );
        }
        for (const player of data.players) {
            await dq.clearVoticeDay(ChatID, player.userID);
        }
    } else {
        await app.bot.telegram.sendMessage(
            ChatID,
            `İnsanların fikirləri fərqli oldu, bu gecə heç kimi asmadılar...`
        );
    }
}


//Обновляем счетчики жителей
function updateCounter(data, i, action) {
    if (action) {
        if (data.players[i].initialRole == ('Zombi'||'Dəli')) {
            data.dataGame.counterPlayers -= 1;
            data.dataGame.counterTriada -= 1;
        } else if (data.players[i].initialRole == ('Cin'||'Ruh')) {
            data.dataGame.counterPlayers -= 1;
            data.dataGame.counterMafia -= 1;
        } else {
            data.dataGame.counterPlayers -= 1;
            data.dataGame.counterWorld -= 1;
        }
    } else {
        if (data.players[i].initialRole == ('Zombi'||'Dəli')) {
            data.dataGame.counterPlayers += 1;
            data.dataGame.counterTriada += 1;
        } else if (data.players[i].initialRole == ('Cin'||'Ruh')) {
            data.dataGame.counterPlayers += 1;
            data.dataGame.counterMafia += 1;
        } else {
            data.dataGame.counterPlayers += 1;
            data.dataGame.counterWorld += 1;
        }
    }
    return data;
}

//Отправляем гифку сначалом дня
async function sendSunMessage(ChatID, i) {
    await app.bot.telegram.sendAnimation(
        ChatID,
        'https://media.tenor.com/images/286ae769ba034e724ce706d371df374d/tenor.gif',
        {
          parse_mode: 'HTML',
          caption: `🌌<b>Cəhənnəmdə ${i} gecə keçirdiniz</b>\nSabahınız xeyir...`,
          reply_markup: keyboards.goToBot(process.env.URL_BOT)
        }
    );
}

//Отправляем список живых игроков для дня
async function sendDayMessageLivePlayers(ChatID, data) {
    let listUsers = '';
    let listRoles = '';
    let caunter = 0;
    let masRole = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    data.players.forEach((player) => {
        if (player.lifeStatus) {
            caunter++;
            listUsers +=`\n${caunter}) <a href="tg://user?id=${player.userID}">${player.name}</a>`;
            switch(player.role) {
                case 'İnsan':
                    masRole[0]+=1;
                    break;
                case 'Cin':
                    masRole[1]=1;
                    break;
                case 'Ruh':
                    masRole[2]=1;
                    break;
                case 'Həkim':
                    masRole[3]=1;
                    break;
                case 'Komissar':
                    masRole[4]=1;
                    break;
                case 'Leytenant':
                    masRole[5]=1;
                    break;
                case 'Ölümsüz':
                    masRole[6]=1;
                    break;
                case 'Kamikadze':
                    masRole[7]=1;
                    break;
                case 'Mühafizəçi':
                    masRole[8]=1;
                    break;
                case 'Manyak':
                    masRole[9]=1;
                    break;
                case 'Məşuqə':
                    masRole[10]=1;
                    break;
                case 'Zombi':
                    masRole[11]=1;
                    break;
                case 'Dəli':
                    masRole[12]=1;
                    break;
            }
        }
    });
    if (masRole[0]>1) {
        listRoles+=`👨🏼 İnsan - ${masRole[0]}, `;
    } else if (masRole[0]==1) {
        listRoles+=`👨🏼 İnsan, `;
    }
    if (masRole[1]==1) { listRoles+=`👹 Cin, `; }
    if (masRole[2]==1) { listRoles+=`👺 Ruh, `; }
    if (masRole[3]==1) { listRoles+=`👨🏼‍⚕️ Həkim, `; }
    if (masRole[4]==1) { listRoles+=`🕵🏼️‍♂️ Komissar, `; }
    if (masRole[5]==1) { listRoles+=`👮🏻 Leytenant, `; }
    if (masRole[6]==1) { listRoles+=`🕺 Ölümsüz, `; }
    if (masRole[7]==1) { listRoles+=`🤦🏼‍♂️ Kamikadze, `; }
    if (masRole[8]==1) { listRoles+=`✊ Mühafizəçi, `; }
    if (masRole[9]==1) { listRoles+=`🔪 Manyak, `; }
    if (masRole[10]==1) { listRoles+=`💃🏻 Məşuqə, `; }
    if (masRole[11]==1) { listRoles+=`🧟‍♀ Zombi, `; }
    if (masRole[12]==1) { listRoles+=`🧘🏻 Dəli, `; }
    await app.bot.telegram.sendMessage(
        ChatID,
        `<b>🔥Sağ qalan oyunçular:</b>`+listUsers+`\n\n<b>Onlardan:</b>`+listRoles.slice(0, -2)+
            `\n👥Cəmi: ${caunter} \n\nİndi gecənin nəticələrini müzakirə etmək vaxtıdır.....\n45 Saniyə sonra səsvermə başlayır`,
        { parse_mode: 'HTML' }
    );
}

//Пауза
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Проверяем жив ли игрок с определенной ролью
function roleLifeCheck(players, role) {
    return players.some((player) => {
        return player.role == role && player.lifeStatus;
    });
}

//Конвертируем время в текст
function convertTimeToText(time) {
    let text = '';
    const timeGame = Date.now() - time,
          hours = Math.floor(timeGame/(1000*60*60)),
          minutes = Math.floor(timeGame/(1000*60))-hours*60,
          seconds = Math.floor(timeGame/(1000))-minutes*60-hours*60*60;
    if (hours != 0) {
        text+=`${hours} s. `;
    }
    if (minutes != 0) {
        text+=`${minutes} dəq. `;
    }
    if (seconds != 0) {
        text+=`${seconds} san. `;
    }
    return text;
}

//Запуск регистрации
async function registration(ChatID) {
    for (let i = 90; i > 0; i -= 30) {
        await sendMessageRegistration(ChatID, i);
        await delay(30000);
        const data = await dq.getDataDeleteMessageRegistration(ChatID);
        if (data.messageID == 0){
            break;
        }
    }
    await deleteMessageRegistration(ChatID);
}


//Отправка сообщения регистрации
async function sendMessageRegistration(ChatID, time) {
    if (time != 90) {
      deleteMessageRegistration(ChatID);
    }
    const messageRegistration = await app.bot.telegram.sendMessage(
        ChatID,
        `Oyun ${time} saniyəyə başlayacaq! \nOyunçuların siyahısı:`+ await getLifeUsersText(ChatID),
        {
            parse_mode: 'HTML',
            reply_markup: keyboards.userRegistrationBtn(process.env.URL_BOT, ChatID)
        }
    );
    await dq.getDataSendMessageRegistration(ChatID, messageRegistration.message_id, time);
}


//Удаление сообщения регистрации
async function deleteMessageRegistration(chatID) {
    const data = await dq.getDataDeleteMessageRegistration(chatID);
    if (data.messageID != 0){
        app.bot.telegram.deleteMessage(chatID, data.messageID);
    }
}


//Получаем список живых игроков
async function getLifeUsersText(chatID) {
    let listUsers = '',
        caunter = 0;
    const data = await dq.getDataPlayers(chatID);

    data.players.forEach((player) => {
        if (player.lifeStatus) {
            caunter++;
            listUsers +=`\n${caunter}) <a href="tg://user?id=${player.userID}">${player.name}</a>`;
        }
    });
    return listUsers;
}

//Дневное голосование
async function lastVote(ChatID, result, userID, userIDAct, messageID, callbackQueryID) {
    const user = await dq.getInfoPlayer(ChatID, userID),
          userAct = await dq.getInfoPlayer(ChatID, userIDAct);

    if (userID != userIDAct) {
        if (user.players[0].lifeStatus &&
            user.players[0].votes &&
            !user.players[0].whetherVoted) {
                if (result) { //За
                    await dq.updateCallbackDataVotesAgainstPlayer(ChatID, userIDAct, 1);
                    app.bot.telegram.editMessageReplyMarkup(
                        ChatID,
                        messageID,
                        null,
                        keyboards.voteYesNoDay(
                            userAct.players[0].userID,
                            userAct.players[0].votesAgainst+1, userAct.players[0].votesFor
                        )
                    );
                    app.bot.telegram.answerCbQuery(callbackQueryID, 'Siz səs verdiniz 👍');
                } else { //Против
                    await dq.updateCallbackDataVotesForPlayer(ChatID, userIDAct, 1);
                    app.bot.telegram.editMessageReplyMarkup(
                        ChatID,
                        messageID,
                        null,
                        keyboards.voteYesNoDay(
                            userAct.players[0].userID,
                            userAct.players[0].votesAgainst, userAct.players[0].votesFor+1
                        )
                    );
                    app.bot.telegram.answerCbQuery(callbackQueryID, 'Siz səs verdiniz 👎');
                }
                await dq.updateCallbackDataVotesPlayer(ChatID, userID, true, result);
        } else if (user.players[0].lifeStatus &&
                   user.players[0].votes &&
                   user.players[0].whetherVoted) {
            //Пользователь уже голосовал
            if (user.players[0].votingResult != result) {
                await dq.updateCallbackDataVotesPlayer(ChatID, userID, true, result);
                if (result) {
                    await dq.updateCallbackDataVotesAgainstPlayer(ChatID, userIDAct, 1);
                    await dq.updateCallbackDataVotesForPlayer(ChatID, userIDAct, -1);
                    app.bot.telegram.editMessageReplyMarkup(
                        ChatID,
                        messageID,
                        null,
                        keyboards.voteYesNoDay(
                            userAct.players[0].userID,
                            userAct.players[0].votesAgainst+1, userAct.players[0].votesFor-1
                        )
                    );
                    app.bot.telegram.answerCbQuery(callbackQueryID, 'Səsini dəyişdirdin 👍');
                } else {
                    await dq.updateCallbackDataVotesAgainstPlayer(ChatID, userIDAct, -1);
                    await dq.updateCallbackDataVotesForPlayer(ChatID, userIDAct, 1);
                    app.bot.telegram.editMessageReplyMarkup(
                        ChatID,
                        messageID,
                        null,
                        keyboards.voteYesNoDay(
                            userAct.players[0].userID,
                            userAct.players[0].votesAgainst-1, userAct.players[0].votesFor+1
                        )
                    );
                    app.bot.telegram.answerCbQuery(callbackQueryID, 'Səsini dəyişdirdin 👎');
                }
            }
        } else {
            app.bot.telegram.answerCbQuery(callbackQueryID, 'Siz səs verə bilməzsiniz!');
        }
    } else {
        app.bot.telegram.answerCbQuery(callbackQueryID, 'Siz səs verə bilməzsiniz!');
    }
}


//Обрабатываем колбеки
export async function callbackQuery(ctx) {
    if (ctx.callbackQuery.data.slice(0, 3) == 'act') {
      await ctx.deleteMessage();
      const messageData = ctx.callbackQuery.data.split(' ');
      await dq.updateDataCounterActiveRoles(messageData[1], false);
      await dq.updateMessageIDPlayer(messageData[1], 0, ctx.callbackQuery.from.id);
      sendMessageAboutProgressRole(messageData[1], ctx.callbackQuery.from.id, messageData[2]);
      await dq.updateCallbackDataPlayer(messageData[1], messageData[2], ctx.callbackQuery.from.id);
    } else if (ctx.callbackQuery.data.slice(0, 2) == 'vs') {
      await ctx.deleteMessage();
      const messageData = ctx.callbackQuery.data.split(' ');
      await dq.updateMessageIDPlayer(messageData[1], 0, ctx.callbackQuery.from.id);
      sendMessageVoiceUserInChat(messageData[1], ctx.callbackQuery.from.id, messageData[2]);
      await dq.updateCallbackDataVotesAgainstPlayer(messageData[1], messageData[2], 1);
    } else if (ctx.callbackQuery.data.slice(0, 8) == 'copcheck') {
      await ctx.deleteMessage();
      await dq.updateDataCounterActiveRoles(ctx.callbackQuery.data.slice(8), true);
      const dataPlayers = await dq.getDataPlayers(ctx.callbackQuery.data.slice(8));
      const message = await app.bot.telegram.sendMessage(
        ctx.callbackQuery.from.id,
        'Kimləri yoxlayacağıq?',
        {
          reply_markup: keyboards.buttonActionsNight(
            ctx.callbackQuery.data.slice(8),
            dataPlayers.players,
            ctx.callbackQuery.from.id, 1)
        }
      );
      await dq.updateCallbackDataCop(ctx.callbackQuery.data.slice(8), true, ctx.callbackQuery.from.id, message.message_id);
    } else if (ctx.callbackQuery.data.slice(0, 7) == 'copkill') {
      await ctx.deleteMessage();
      await dq.updateDataCounterActiveRoles(ctx.callbackQuery.data.slice(7), true);
      const dataPlayers = await dq.getDataPlayers(ctx.callbackQuery.data.slice(7));
      const message = await app.bot.telegram.sendMessage(
        ctx.callbackQuery.from.id,
        'Kimləri öldürəcəyik?',
        {
          reply_markup: keyboards.buttonActionsNight(
            ctx.callbackQuery.data.slice(7),
            dataPlayers.players,
            ctx.callbackQuery.from.id, 1)
        }
      );
      await dq.updateCallbackDataCop(ctx.callbackQuery.data.slice(7), false, ctx.callbackQuery.from.id, message.message_id);
    } else if (ctx.callbackQuery.data == 'newgame') {
      await ctx.deleteMessage();
      if (functions.checkBotAdmin(ctx.callbackQuery.message.chat.id)) {
        functions.updateOrAddChatInBD(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.chat.title);
        launch(ctx.callbackQuery.message.chat.id);
      }
    } else if (ctx.callbackQuery.data.slice(0, 3) == 'yes') {
      await lastVote(
        ctx.callbackQuery.message.chat.id, //ChatID
        true,                              //Голос за
        ctx.callbackQuery.from.id,         //Айди того кто нажал на кнопку
        ctx.callbackQuery.data.slice(3),   //Айди того кому нужно добавить голос
        ctx.callbackQuery.message.message_id,//Айди сообщения которое нужно изменить
        ctx.callbackQuery.id
        );
    } else if (ctx.callbackQuery.data.slice(0, 2) == 'no') {
      await lastVote(
        ctx.callbackQuery.message.chat.id, //ChatID
        false,                              //Голос за
        ctx.callbackQuery.from.id,         //Айди того кто нажал на кнопку
        ctx.callbackQuery.data.slice(2),   //Айди того кому нужно добавить голос
        ctx.callbackQuery.message.message_id,//Айди сообщения которое нужно изменить
        ctx.callbackQuery.id
        );
    }
  }

