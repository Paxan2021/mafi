'use strict';

import Markup from 'telegraf/markup.js';

export function userRegistrationBtn(urlBot, chatID) {
    return Markup.inlineKeyboard([
        Markup.urlButton('Oyuna Qoşul 🔥', urlBot+'?start='+chatID)
    ]);
}

export function voteDay(urlBot) {
    return Markup.inlineKeyboard([
        Markup.urlButton('Səs Verin', urlBot)
    ]);
}

export function goToBot(urlBot) {
    return Markup.inlineKeyboard([
        Markup.urlButton('👥 Bota keç', urlBot)
    ]);
}

export function voteYesNoDay(userID, counterYes, counterNo) {
    if (counterYes == 0) { counterYes = ''; }
    if (counterNo == 0) { counterNo = ''; }
    return Markup.inlineKeyboard([
        Markup.callbackButton(`${counterYes} 👍`, 'yes'+userID),
        Markup.callbackButton(`${counterNo} 👎`, 'no'+userID)
    ], {columns: 2});
}

export function newGame() {
    return Markup.inlineKeyboard([
        Markup.callbackButton('Yeni oyuna başla!', 'newgame')
    ]);
}

export function checkOrKill(ChatID) {
    return Markup.inlineKeyboard([
        Markup.callbackButton('Yoxla', 'copcheck'+ChatID),
        Markup.callbackButton('Öldür', 'copkill'+ChatID)
    ], {columns: 2});
}

export function buttonActionsNight(ChatID, players, userID, allies) {
    let keyboard = [];
    players.forEach((player) => {
        if(player.lifeStatus) {
            if (player.userID == userID && (player.role != 'Komissar'||
                                            player.role != 'Mühafizəçi'||
                                            player.role != 'Manyak'||
                                            player.role != 'Iblis'||
                                            player.role != 'Məşuqə'||
                                            player.role != 'Dəli')) {
                keyboard.push(Markup.callbackButton('☑️ '+player.name, `act ${ChatID} ${player.userID}`));
            } else {
                if (allies!=0 && player.allies==allies) {
                    keyboard.push(Markup.callbackButton('☑️ '+player.name, `act ${ChatID} ${player.userID}`));
                } else {
                    keyboard.push(Markup.callbackButton(player.name, `act ${ChatID} ${player.userID}`));
                }
            }
        }
    });
    return Markup.inlineKeyboard(keyboard, {columns: 1});
}

export function buttonActionsDay(ChatID, players, userID) {
    let keyboard = [];
    players.forEach((player) => {
        if(player.lifeStatus && player.userID != userID) {
            keyboard.push(Markup.callbackButton(player.name, `vs ${ChatID} ${player.userID}`));
        }
    });
    return Markup.inlineKeyboard(keyboard, {columns: 1});
}
