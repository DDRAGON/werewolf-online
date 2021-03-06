const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo");

const tables = [];
for (let tableId = 1; tableId <= 16; tableId++) {
   const table = {
       tableId: tableId,
       players: new Map(),
       playerBySockets: new Map(),
       AIs: new Map(),
       chats: new Map(),
       privateChats: new Map(),
       fortuneToldPlayersMap: new Map(),
       werewolfPlayerIds: [],
       tableState: 'waiting'
   };

    const dt = new Date();
    //dt.setMinutes(dt.getMinutes() + 1 + (tableId-1)*10);
    dt.setSeconds(dt.getSeconds() + 20 + (tableId-1)*10);
    table.startTime = dt.getTime();

    setTimeout(function() {startGame(tableId);}, dt.getTime() - new Date().getTime()); // ゲーム開始時刻の設定
    tables[tableId] = table;
}

const gameObj = {
    tables: tables,
    morningMinutes: 1
};


function newConnection(socketId, tableId, displayName, thumbUrl, twitterId) {

   const table = gameObj.tables[tableId];
   const playerId = calcPlayerId(tableId, displayName, twitterId);

   if (!table.players.has(playerId)) {
       // new player
       const player = {
           tableId,
           playerId,
           displayName,
           thumbUrl,
           twitterId,
           socketId,
           isAlive: true
       };

       table.players.set(playerId, player);
       table.playerBySockets.set(socketId, {playerId});

       // トップページに送信
       const tablesInfo = entryConnection();
       gameObj.EntryRootIo.emit('tables data', tablesInfo);

   } else {
       const previousPlayer = table.players.get(playerId);
       const previousSocketId = previousPlayer.socketId;
       const role = previousPlayer.role;
       table.playerBySockets.delete(previousSocketId);
       table.playerBySockets.set(socketId, {playerId});
       previousPlayer.socketId = socketId;
       if (previousPlayer.role) {
           gameObj.tableSocketsMap.get(tableId).to(socketId).emit('your role', role);
           if (role && role === '人狼') {
               gameObj.tableSocketsMap.get(tableId).to(socketId).emit('your teams', table.werewolfPlayerIds);
           }
       }
   }

   return {
       chats: Array.from(table.chats),
       startTime:  table.startTime,
       tableState: table.tableState,
       yourPlayerId: playerId
   };
}

function getPlayersList(tableId) {
    const playersList = new Map();
    for ([playerId, player] of gameObj.tables[tableId].players) {
        playersList.set(playerId, {
            playerId,
            displayName: player.displayName,
            type: 'player',
            isAlive: player.isAlive,
            votedto: player.votedto,
            runoffElectionVotedto: player.runoffElectionVotedto
        });
    }
    for ([aiId, ai] of gameObj.tables[tableId].AIs) {
        playersList.set(aiId, {
            aiId,
            displayName: ai.displayName,
            type: 'AI',
            isAlive: ai.isAlive,
            votedto: ai.votedto,
            runoffElectionVotedto: ai.runoffElectionVotedto
        });
    }
   return Array.from(playersList);
}

function gotChatText(socketId, tableId, displayName, thumbUrl, chatText) {
    const table = gameObj.tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);
    if (sendPlayer.isAlive === false) { return; }

    const chatTime = new Date().getTime();
    const chatId = calcChatId(tableId, displayName, chatText, chatTime);
    const chatObj = {
        chatId,
        chatText,
        displayName,
        thumbUrl,
        chatTime
    };
    table.chats.set(chatId, chatObj);

    gameObj.tableSocketsMap.get(tableId).emit('new chat', chatObj);
}

function gotPrivateChatText(socketId, tableId, displayName, thumbUrl, privateChatText) {
    const table = gameObj.tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);
    if (sendPlayer.isAlive === false) { return; }

    const sendPlayerRole = sendPlayer.role;
    if (sendPlayerRole === '共有者' || sendPlayerRole === '妖狐' || sendPlayerRole === '人狼') {

        const chatTime = new Date().getTime();
        const privateChatId = calcPrivateChatId(tableId, displayName, privateChatText, sendPlayerRole, chatTime);
        const privateChatObj = {
            privateChatId,
            privateChatText,
            displayName,
            thumbUrl,
            chatTime
        };
        table.privateChats.set(privateChatId, privateChatObj);

        // 同じ役職の人に送信
        for ([playerId, player] of table.players) {
            if (player.role === sendPlayerRole) {
                const socketId = player.socketId;
                gameObj.tableSocketsMap.get(tableId).to(socketId).emit('new private chat', privateChatObj);
            }
        }

    }
}

function entryConnection() {
    const tablesInfo = [];
    for (let tableId = 1; tableId <= 16; tableId++) {
        tablesInfo[tableId] = {
            startTime: gameObj.tables[tableId].startTime,
            tableState: gameObj.tables[tableId].tableState,
            playersNum: gameObj.tables[tableId].players.size
       };
   }

   return tablesInfo;
}

function startGame(tableId) {
    const table = tables[tableId];
    table.tableState = 'gaming';
    table.day = 1;
    table.time = 'morning';
    const tablesInfo = entryConnection();
    gameObj.EntryRootIo.emit('tables data', tablesInfo);

    addAIs(tableId); // AI の追加
    addRoles(tableId); // 役職決め

    for ([socketId, player] of tables[tableId].playerBySockets) {
        const playerId = player.playerId;
        const role = table.players.get(playerId).role;
        gameObj.tableSocketsMap.get(tableId).to(socketId).emit('your role', role);
        if (role === '人狼') {
            gameObj.tableSocketsMap.get(tableId).to(socketId).emit('your teams', table.werewolfPlayerIds);
        }
    }

    const dt = new Date();
    //dt.setMinutes(dt.getMinutes() + gameObj.morningMinutes); // 朝の時間は５分
    dt.setSeconds(dt.getSeconds() + 10);
    table.nextEventTime = dt.getTime();

    gameObj.tableSocketsMap.get(tableId).emit('game start', {
        tableState: table.tableState,
        day: table.day,
        time: table.time,
        nextEventTime: table.nextEventTime,
        playersList: getPlayersList(tableId)
    });

    setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
}

function changeEvent(tableId) {
    const table = tables[tableId];
    const dt = new Date();
    let suspendedPlayersMap = new Map();
    let playersAndAIsMap = new Map();

    switch (table.time) {
        case 'morning':
            table.time = 'morningVote';

            resetVotedto(tableId);
            resetRunoffElectionVotedto(tableId);

            // dt.setMinutes(dt.getMinutes() + 1); // 投票の時間は１分
            dt.setSeconds(dt.getSeconds() + 10);
            table.nextEventTime = dt.getTime();

            gameObj.tableSocketsMap.get(tableId).emit('morning vote start', {
                time: table.time,
                nextEventTime: table.nextEventTime,
                playersList: getPlayersList(tableId)
            });

            setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
            break;

        case 'morningVote':
            playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));
            const playersOnlyAliveMap = makePlayersOnlyAlive(table);
            suspendedPlayersMap = voteAddingUp(tableId, playersOnlyAliveMap);
            table.suspendedPlayers = suspendedPlayersMap;

            if (suspendedPlayersMap.size === 1) {
                table.time = 'morningVoteResult';
                suspendPlayer(tableId, suspendedPlayersMap);
            } else if (suspendedPlayersMap.size > 1) {
                table.time = 'morningVoteResultAndNextIsRunoffElection';
            }

            dt.setSeconds(dt.getSeconds() + 10); // 投票結果は 10秒だけ表示
            table.nextEventTime = dt.getTime();

            gameObj.tableSocketsMap.get(tableId).emit('morning vote result', {
                time: table.time,
                nextEventTime: table.nextEventTime,
                playersList: getPlayersList(tableId),
                aisList: getPlayersList(tableId),
                suspendedPlayers: Array.from(suspendedPlayersMap)
            });

            setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
            break;

        case 'morningVoteResult':
        case 'runoffElectionResult':
            table.time = 'night';
            // dt.setMinutes(dt.getMinutes() + 1); // 夜の時間は１分
            dt.setSeconds(dt.getSeconds() + 15);
            table.nextEventTime = dt.getTime();

            suspendPlayer(tableId, table.suspendedPlayers); // 決戦投票は何が何でも一人吊る

            night(table, table.nextEventTime);
            setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
            break;

        case 'morningVoteResultAndNextIsRunoffElection':
            table.time = 'runoffElection';

            // dt.setMinutes(dt.getMinutes() + 1); // 決選投票の時間は１分
            dt.setSeconds(dt.getSeconds() + 10);
            table.nextEventTime = dt.getTime();

            gameObj.tableSocketsMap.get(tableId).emit('runoff election start', {
                time: table.time,
                nextEventTime: table.nextEventTime,
                playersList: getPlayersList(tableId),
                suspendedPlayers: Array.from(table.suspendedPlayers)
            });

            setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
            break;

        case 'runoffElection':
           suspendedPlayersMap = voteAddingUp(tableId, table.suspendedPlayers);
           table.suspendedPlayers = suspendedPlayersMap;

           table.time = 'runoffElectionResult';

           dt.setSeconds(dt.getSeconds() + 10); // 投票結果は 30秒だけ表示
           table.nextEventTime = dt.getTime();

           gameObj.tableSocketsMap.get(tableId).emit('runoff election result', {
              time: table.time,
              nextEventTime: table.nextEventTime,
              playersList: getPlayersList(tableId),
              suspendedPlayers: Array.from(suspendedPlayersMap)
           });

           setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
           break;

        case 'night':
            playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));

            let killedPlayersMap = nightVoteAddingUp(table, playersAndAIsMap);
            killedPlayersMap = fortuneTellingAddingUp(table, playersAndAIsMap, killedPlayersMap);
            const publicDataOfKilledPlayersMap = new Map();
            for ([playerId, player] of killedPlayersMap) {
                const publicData = {
                    playerId,
                    displayName: player.displayName
                };
                publicDataOfKilledPlayersMap.set(playerId, publicData);
            }

            table.time = 'nightResultMorning';
            table.day += 1;

            //dt.setMinutes(dt.getMinutes() + gameObj.morningMinutes); // 夜の結果発表時間は15秒
            dt.setSeconds(dt.getSeconds() + 15);
            table.nextEventTime = dt.getTime();

            gameObj.tableSocketsMap.get(tableId).emit('night result', {
                time: table.time,
                day: table.day,
                nextEventTime: table.nextEventTime,
                playersList: getPlayersList(tableId),
                killedPlayersMap: Array.from(publicDataOfKilledPlayersMap)
            });
            sendDeadPlayersColorToPsychic(table); // 霊能者に死者の情報を送る

            setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定
            break;

        case 'nightResultMorning':

            const gameEndObj = checkGameEnd(table);

            if (gameEndObj.isGameEnd === false) {

                table.time = 'morning';

                //dt.setMinutes(dt.getMinutes() + gameObj.morningMinutes); // 朝の時間は５分
                dt.setSeconds(dt.getSeconds() + 10);
                table.nextEventTime = dt.getTime();

                gameObj.tableSocketsMap.get(tableId).emit('morning start', {
                    tableState: table.tableState,
                    time: table.time,
                    nextEventTime: table.nextEventTime,
                    playersList: getPlayersList(tableId)
                });

                setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定

            } else {

                table.time = 'gameResult';

                //dt.setMinutes(dt.getMinutes() + gameObj.morningMinutes); // 次のゲームまでの時間は１０分
                dt.setSeconds(dt.getSeconds() + 10);
                table.nextEventTime = dt.getTime();

                gameObj.tableSocketsMap.get(tableId).emit('game result', {
                    tableState: table.tableState,
                    time: table.time,
                    nextEventTime: table.nextEventTime,
                    isGameEnd: gameEndObj.isGameEnd,
                    winType: gameEndObj.winType,
                    winPlayersMap: Array.from(gameEndObj.winPlayersMap),
                    allPlayersRoleMap: Array.from(gameEndObj.allPlayersRoleMap)
                });

                setTimeout(function() {changeEvent(tableId);}, dt.getTime() - new Date().getTime()); // 次のイベント時刻の設定

            }


            break;
    }
}

function night(table, nextEventTime) {
    const playersWithoutWerewolfMap = makePlayersWithoutWerewolf(table);
    for (let [playerId, player] of table.players) {
        const socketId = player.socketId;

        if (player.role === '人狼') {
            player.werewolfVotedto = null;
            gameObj.tableSocketsMap.get(table.tableId).to(socketId).emit('Hi werewolf, night has come', {
                playersWithoutWerewolfMap: Array.from(playersWithoutWerewolfMap),
                time: table.time,
                nextEventTime,
                playersList: getPlayersList(table.tableId)
            });
        } else if (player.role === '占い師') {
            table.tellFortunesto = null;
            const playersForFortuneTellerMap = getPlayersColorFortuneTeller(table);
            gameObj.tableSocketsMap.get(table.tableId).to(socketId).emit('Hi fortune teller, night has come', {
                playersForFortuneTellerMap: Array.from(playersForFortuneTellerMap),
                time: table.time,
                nextEventTime,
                playersList: getPlayersList(table.tableId)
            });
        } else if (player.role === '狩人') {
            table.protectto = null;
            gameObj.tableSocketsMap.get(table.tableId).to(socketId).emit('Hi hunter, night has come', {
                time: table.time,
                nextEventTime,
                playersList: getPlayersList(table.tableId)
            });
        } else {
            gameObj.tableSocketsMap.get(table.tableId).to(socketId).emit('night has come', {
                time: table.time,
                nextEventTime,
                playersList: getPlayersList(table.tableId)
            });
        }
    }
    sendDeadPlayersColorToPsychic(table); // 霊能者に死者の情報を送る
}

function makePlayersOnlyAlive(table) {
    const playersOnlyAliveMap = new Map();
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));

    for (let [playerId, player] of playersAndAIsMap) {
        if (player.isAlive === true) {
            playersOnlyAliveMap.set(playerId, player);
        }
    }

    return playersOnlyAliveMap;
}

function makePlayersWithoutWerewolf(table) {
    const playersWithoutWerewolfMap = new Map();
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));

    for (let [playerId, player] of playersAndAIsMap) {
        if (player.role !== '人狼' && player.isAlive === true) {
            playersWithoutWerewolfMap.set(playerId, player);
        }
    }

    return playersWithoutWerewolfMap;
}

function getDeadPlayersColor(table) {
    const deadPlayersColorMap = new Map();
    const publicPlayersMap = new Map(getPlayersList(table.tableId));
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));
    for (let [playerId, player] of publicPlayersMap) {
        if (player.isAlive === false) {
            const color = getColorFromRole(playersAndAIsMap.get(playerId).role);
            deadPlayersColorMap.set(playerId, color);
        }
    }

    return deadPlayersColorMap;
}

function getPlayersColorFortuneTeller(table) {
    const publicPlayersMap = new Map(getPlayersList(table.tableId));
    for (let [playerId, player] of table.fortuneToldPlayersMap) {
        if (publicPlayersMap.has(playerId)) {
            publicPlayersMap.get(playerId).color = player.color
        }
    }

    return publicPlayersMap;
}

function getColorFromRole(role) {
    if (
        role === '村人' || role === '共有者' || role === '占い師' ||　role === '狩人' ||
        role === '霊能者' ||　role === '狂人' ||　role === '妖狐'
    ) {
        return '白';
    }

    if (role === '人狼') {
        return '黒'
    }
}

function registerEntryRootIo(rootIo){
    gameObj.EntryRootIo = rootIo;
}

function registerTablesRootIo(tableSocketsMap) {
    gameObj.tableSocketsMap = tableSocketsMap;
}

function morningVoted(socketId, tableId, playerId) {
    const table = tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);

    if (sendPlayer.votedto || !sendPlayer.isAlive) return; // すでに投票している。もしくは死者

    let votedPlayer;
    if (table.players.has(playerId)) {
        votedPlayer = table.players.get(playerId);
    } else if (table.AIs.has(playerId)) {
        votedPlayer = table.AIs.get(playerId);
    } else {
        console.log(`table ${tableId}、 voted player not found.`);
        return;
    }


    sendPlayer.votedto = {
        playerId,
        displayName: votedPlayer.displayName,
        voteMethod: 'choice'
    }
}

function runoffElectionVoted(socketId, tableId, playerId) {
    const table = tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));

    if (sendPlayer.runoffElectionVotedto || !sendPlayer.isAlive) return; // すでに投票している。もしくは死者
    if (!table.suspendedPlayers.has(playerId)) return; // 決戦帳票の候補者ではない。

    let votedPlayer;
    if (playersAndAIsMap.has(playerId)) {
        votedPlayer = playersAndAIsMap.get(playerId);
    } else {
        console.log(`table ${tableId}、 voted player not found.`);
        return;
    }

    if (!votedPlayer.isAlive) return; // 死者に投票している。


    sendPlayer.runoffElectionVotedto = {
        playerId,
        displayName: votedPlayer.displayName,
        voteMethod: 'choice'
    }
}

function werewolfVoted(socketId, tableId, playerId){
    const table = tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);

    if (sendPlayer.role !== '人狼' || sendPlayer.werewolfVotedto || !sendPlayer.isAlive) return; // すでに投票している。もしくは死者

    let votedPlayer;
    if (table.players.has(playerId)) {
        votedPlayer = table.players.get(playerId);
    } else if (table.AIs.has(playerId)) {
        votedPlayer = table.AIs.get(playerId);
    } else {
        console.log(`table ${tableId}、 voted player not found.`);
        return;
    }


    sendPlayer.werewolfVotedto = {
        playerId,
        displayName: votedPlayer.displayName,
        voteMethod: 'choice'
    };
}

function tellFortunes(socketId, tableId, playerId) {
    const table = tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);

    if (sendPlayer.role !== '占い師' || table.tellFortunesto || !sendPlayer.isAlive) return; // すでに投票している。もしくは死者

    let votedPlayer;
    if (table.players.has(playerId)) {
        votedPlayer = table.players.get(playerId);
    } else if (table.AIs.has(playerId)) {
        votedPlayer = table.AIs.get(playerId);
    } else {
        console.log(`table ${tableId}、 tolled fortune player not found.`);
        return;
    }

    table.tellFortunesto = {
        playerId,
        displayName: votedPlayer.displayName,
        voteMethod: 'choice'
    };

    // 結果を送り返す
    const color = getColorFromRole(votedPlayer.role);
    table.fortuneToldPlayersMap.set(playerId, color);
    gameObj.tableSocketsMap.get(tableId).to(socketId).emit('result of fortune telling', {
        playerId,
        displayName: votedPlayer.displayName,
        color
    });
}

function protect(socketId, tableId, playerId) {
    const table = tables[tableId];
    const sendPlayerId = table.playerBySockets.get(socketId).playerId;
    const sendPlayer = table.players.get(sendPlayerId);

    if (sendPlayer.role !== '狩人' || table.protectto || !sendPlayer.isAlive) return; // すでに投票している。もしくは死者

    let votedPlayer;
    if (table.players.has(playerId)) {
        votedPlayer = table.players.get(playerId);
    } else if (table.AIs.has(playerId)) {
        votedPlayer = table.AIs.get(playerId);
    } else {
        console.log(`table ${tableId}、 protected player not found.`);
        return;
    }

    if (votedPlayer.role === '狩人') return; // 狩人を守ることはできない。

    table.protectto = {
        playerId,
        displayName: votedPlayer.displayName,
        voteMethod: 'choice'
    };
}


function voteAddingUp(tableId, candidatesMap) {
    const table = tables[tableId];
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));
    const votedPlayers = new Map();
    let mostVote = 0;
    let mostVotedPlayers = new Map();

    for (let [playerId, player] of playersAndAIsMap) {
        if (player.isAlive === false) continue;

        if (table.time === 'morningVote' && !player.votedto) {
            // 投票してなかった場合はランダム
            const randIndex = Math.floor(Math.random() * candidatesMap.size);
            const votedPlayerId = Array.from(candidatesMap)[randIndex][0];
            const votedPlayer = candidatesMap.get(votedPlayerId);
            player.votedto = {
                playerId: votedPlayerId,
                displayName: votedPlayer.displayName,
                voteMethod: 'random'
            };
        }

        if (table.time === 'runoffElection' && !player.runoffElectionVotedto) {
           // 投票してなかった場合はランダム
           const randIndex = Math.floor(Math.random() * candidatesMap.size);
           const votedPlayerId = Array.from(candidatesMap)[randIndex][0];
           const votedPlayer = candidatesMap.get(votedPlayerId);
           player.runoffElectionVotedto = {
               playerId: votedPlayerId,
               displayName: votedPlayer.displayName,
               voteMethod: 'random'
           };
        }

        let votedPlayerId;
        if (table.time === 'morningVote') {
           votedPlayerId = player.votedto.playerId;
           if (votedPlayers.has(votedPlayerId)) {
              const votedPlayer = votedPlayers.get(votedPlayerId);
              votedPlayer.count += 1;
           } else {
              const votedPlayer = {
                 votedPlayerId,
                 displayName: player.votedto.displayName,
                 count: 1
              };
              votedPlayers.set(votedPlayerId, votedPlayer);
           }
        }
        if (table.time === 'runoffElection') {
           votedPlayerId = player.runoffElectionVotedto.playerId;
           if (votedPlayers.has(votedPlayerId)) {
              const votedPlayer = votedPlayers.get(votedPlayerId);
              votedPlayer.count += 1;
           } else {
              const votedPlayer = {
                 votedPlayerId,
                 displayName: player.runoffElectionVotedto.displayName,
                 count: 1
              };
              votedPlayers.set(votedPlayerId, votedPlayer);
           }
        }

        const votedPlayer = votedPlayers.get(votedPlayerId);
        if (mostVote < votedPlayer.count) {
            mostVote = votedPlayer.count;
            mostVotedPlayers = new Map();
            mostVotedPlayers.set(votedPlayerId, votedPlayer);
        } else if (mostVote === votedPlayer.count) {
            mostVotedPlayers.set(votedPlayerId, votedPlayer);
        }
    }

    if (table.time === 'runoffElection') {
        if (mostVotedPlayers.size > 1) {
            // 決戦投票で複数人候補者がいた場合はランダムで吊る
            const randIndex = Math.floor(Math.random() * mostVotedPlayers.size);
            const suspendPlayerId = Array.from(mostVotedPlayers)[randIndex][0];
            const psuspendPlayer = playersAndAIsMap.get(suspendPlayerId);
            mostVotedPlayers = new Map();
            mostVotedPlayers.set(suspendPlayerId, psuspendPlayer);
        }
    }
    return mostVotedPlayers;
}

function nightVoteAddingUp(table, playersAndAIsMap) {
    const votedPlayers = new Map();
    let mostVote = 0;
    let mostVotedPlayers = new Map();

    for ([playerId, player] of playersAndAIsMap) {
        if (player.role !== '人狼' || player.isAlive === false) continue;
        if (!player.werewolfVotedto) continue;

        const votedPlayerId = player.werewolfVotedto.playerId;
        if (votedPlayers.has(votedPlayerId)) {
            const votedPlayer = votedPlayers.get(votedPlayerId);
            votedPlayer.count += 1;
        } else {
            const votedPlayer = {
                votedPlayerId,
                displayName: player.werewolfVotedto.displayName,
                count: 1
            };
            votedPlayers.set(votedPlayerId, votedPlayer);
        }

        const votedPlayer = votedPlayers.get(votedPlayerId);
        if (mostVote < votedPlayer.count) {
            mostVote = votedPlayer.count;
            mostVotedPlayers = new Map();
            mostVotedPlayers.set(votedPlayerId, votedPlayer);
        } else if (mostVote === votedPlayer.count) {
            mostVotedPlayers.set(votedPlayerId, votedPlayer);
        }
    }

    const killedPlayersMap = new Map();
    let killedPlayer;
    if (mostVotedPlayers.size > 1) {

        // ランダムに一人に決める。
        const randIndex = Math.floor(Math.random() * killedPlayersMap.size);
        const killedPlayerId = Array.from(mostVotedPlayers)[randIndex][0];
        killedPlayer = playersAndAIsMap.get(killedPlayerId);

    } else if (mostVotedPlayers.size === 1) {

        const killedPlayerId = Array.from(mostVotedPlayers)[0][0];
        killedPlayer = playersAndAIsMap.get(killedPlayerId);

    } else if (mostVotedPlayers.size === 0) {

        // ランダムに一人に決める。
        const playersWithoutWerewolfMap = makePlayersWithoutWerewolf(table);
        const randIndex = Math.floor(Math.random() * playersWithoutWerewolfMap.size);
        const killedPlayerId = Array.from(playersWithoutWerewolfMap)[randIndex][0];
        killedPlayer = playersAndAIsMap.get(killedPlayerId);

    }

    if (killedPlayer.role === '妖狐' || killedPlayer.role === '人狼') return killedPlayersMap; // 妖狐と人狼は殺害できない。
    if (table.protectto && table.protectto.playerId === killedPlayer.playerId) return killedPlayersMap; // 狩人が守った

    // 狼に殺された
    killedPlayer.isAlive = false;
    killedPlayersMap.set(killedPlayer.playerId, killedPlayer);

    return killedPlayersMap;
}

function fortuneTellingAddingUp(table, playersAndAIsMap, killedPlayersMap) {
    if (!table.tellFortunesto) return killedPlayersMap; // 占っていなかったら終了

    // 妖狐は占われたら死ぬ。
    const tolledPlayer = playersAndAIsMap.get(table.tellFortunesto.playerId);
    if (tolledPlayer.role === '妖狐') {
        tolledPlayer.isAlive = false;
        killedPlayersMap.set(tolledPlayer.playerId, tolledPlayer);

    }

    return killedPlayersMap;
}

function suspendPlayer(tableId, suspendedPlayersMap) {
    const table = tables[tableId];
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));

    for ([suspendedPlayerId, suspendedPlayer] of suspendedPlayersMap) {
        playersAndAIsMap.get(suspendedPlayerId).isAlive = false;
    }
}

function sendDeadPlayersColorToPsychic(table) {
    for (let [playerId, player] of table.players) {
        const socketId = player.socketId;

        if (player.role === '霊能者' && player.isAlive === true) {
            const deadPlayersColorMap = getDeadPlayersColor(table);
            gameObj.tableSocketsMap.get(table.tableId).to(socketId).emit('Hi psychic, give you ghost data', Array.from(deadPlayersColorMap));
        }
    }
}

function addAIs(tableId) {
    for(let aiId = 1; aiId <= (10 - gameObj.tables[tableId].players.size); aiId++) {
        const ai = {
            tableId,
            displayName: `AI${aiId}`,
            thumbUrl: null,
            twitterId: `AI${aiId}`,
            isAlive: true
        };
        tables[tableId].AIs.set(`AI${aiId}`, ai);
    }
}

function addRoles(tableId) {
    const table = tables[tableId];
    const numOfPlayers = gameObj.tables[tableId].players.size + gameObj.tables[tableId].AIs.size;
    const rolesArray = createRolesArray(numOfPlayers);

    for ([playerId, player] of gameObj.tables[tableId].players) {
        const roleIndex = Math.floor(Math.random() * rolesArray.length);
        player.role = rolesArray[roleIndex];
        if (player.role === '人狼') { table.werewolfPlayerIds.push(playerId); }
        rolesArray.splice(roleIndex, 1);
    }
    for ([aiId, ai] of gameObj.tables[tableId].AIs) {
        const roleIndex = Math.floor(Math.random() * rolesArray.length);
        ai.role = rolesArray[roleIndex];
        if (ai.role === '人狼') { table.werewolfPlayerIds.push(aiId); }
        rolesArray.splice(roleIndex, 1);
    }

    // デバッグ用 役職コントロール
    /*
    const changeRole = '霊能者';
    for ([socketId, player] of gameObj.tables[tableId].players) {
        for ([aiId, ai] of gameObj.tables[tableId].AIs) {
            if (ai.role === changeRole) {
                ai.role = player.role;
                player.role = changeRole;
            }
        }
    }
    */
}

// 参考 https://ruru-jinro.net/cast.jsp
function createRolesArray(numOfPlayers) {
    switch (numOfPlayers) {
        case 10:
            return ['村人', '村人', '村人', '村人', '村人', '占い師', '霊能者', '狂人', '人狼', '人狼'];
        case 11:
            return ['村人', '村人', '村人', '村人', '村人', '占い師', '霊能者', '狩人', '狂人', '人狼', '人狼'];
        case 12:
            return ['村人', '村人', '村人', '村人', '村人', '村人', '占い師', '霊能者', '狩人', '狂人', '人狼', '人狼'];
        case 13:
            return ['村人', '村人', '村人', '村人', '村人', '共有者', '共有者', '占い師', '霊能者', '狩人', '狂人', '人狼', '人狼'];
        case 14:
            return ['村人', '村人', '村人', '村人', '村人', '共有者', '共有者', '占い師', '霊能者', '狩人', '妖狐', '狂人', '人狼', '人狼'];
        case 15:
            return ['村人', '村人', '村人', '村人', '村人', '村人', '共有者', '共有者', '占い師', '霊能者', '狩人', '妖狐', '狂人', '人狼', '人狼'];
        case 16:
            return ['村人', '村人', '村人', '村人', '村人', '村人', '共有者', '共有者', '占い師', '霊能者', '狩人', '妖狐', '狂人', '人狼', '人狼', '人狼'];
    }

    // これ以上プレイヤー数が多い場合は一般化して求める。
    const numOfWerewolfs = Math.floor(numOfPlayers / 5); // 人狼の数
    const numOfMadmans  = Math.floor(numOfPlayers / 28) + 1; // 狂人の数
    const numOfShares = Math.floor(numOfPlayers / 13) + 1; // 共有者の数;
    const numOfInus = Math.floor(numOfPlayers / 14); // 妖狐の数;
    const numOfHunters = Math.floor(numOfPlayers / 30) + 1; // 狩人の数;
    const numOfVillager = numOfPlayers - numOfWerewolfs - numOfMadmans - numOfShares - numOfInus - numOfHunters - 2; // 占い師と霊能者の数もひく

    const rolesArray = [];
    for (let i = 0; i < numOfVillager; i++) {
        rolesArray.push('村人');
    }
    for (let i = 0; i < numOfShares; i++) {
        rolesArray.push('共有者');
    }
    rolesArray.push('占い師');
    rolesArray.push('霊能者');
    for (let i = 0; i < numOfHunters; i++) {
        rolesArray.push('狩人');
    }
    for (let i = 0; i < numOfInus; i++) {
        rolesArray.push('妖狐');
    }
    for (let i = 0; i < numOfMadmans; i++) {
        rolesArray.push('狂人');
    }
    for (let i = 0; i < numOfWerewolfs; i++) {
        rolesArray.push('人狼');
    }

    return rolesArray;
}

function resetVotedto(tableId) {
    const table = tables[tableId];
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));
    for (let [playerId, player] of playersAndAIsMap) {
        player.votedto = null;
    }
}

function resetRunoffElectionVotedto(tableId) {
    const table = tables[tableId];
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));
    for (let [playerId, player] of playersAndAIsMap) {
        player.runoffElectionVotedto = null;
    }
}

function checkGameEnd(table) {
    const playersAndAIsMap = new Map(Array.from(table.players).concat(Array.from(table.AIs)));
    const whitePlayersMap = new Map();
    const blackPlayersMap = new Map();
    const inuPlayersMap = new Map();
    const allPlayersRoleMap = new Map();
    let aliveWhiteCount = 0;
    let aliveBlackCount = 0;
    let isAliveInus = false;

    for (let [playerId, player] of playersAndAIsMap) {

        const playerForSend = {
            playerId,
            displayName: player.displayName,
            role: player.role,
            isAlive: player.isAlive
        };
        allPlayersRoleMap.set(playerId, playerForSend);


        if (player.role === '妖狐') {
            inuPlayersMap.set(playerId, playerForSend);
        } else if (player.role === '狂人' || player.role === '人狼') {
            blackPlayersMap.set(playerId, playerForSend);
        } else {
            whitePlayersMap.set(playerId, playerForSend);
        }

        if (player.isAlive === false) continue;

        if (getColorFromRole(player.role) === '白') {
            aliveWhiteCount += 1;
        } else if (getColorFromRole(player.role) === '黒') {
            aliveBlackCount += 1;
        }

        if (player.role === '妖狐') {
            isAliveInus = true;
        }
    }

    if (aliveBlackCount === 0) { // 狼が全滅
        if (isAliveInus === false) { // 村人陣営の勝ち
            return {
                isGameEnd: true,
                winType: '村人陣営',
                winPlayersMap: whitePlayersMap,
                allPlayersRoleMap
            }
        } else {
            return {
                isGameEnd: true,
                winType: '妖狐陣営',
                winPlayersMap: inuPlayersMap,
                allPlayersRoleMap
            }
        }

    }

    if (aliveBlackCount >= aliveWhiteCount) { // 狼の方が上回った
        if (isAliveInus === false) { // 狼陣陣営の勝ち
            return {
                isGameEnd: true,
                winType: '狼陣営',
                winPlayersMap: blackPlayersMap,
                allPlayersRoleMap
            }
        } else {
            return {
                isGameEnd: true,
                winType: '妖狐陣営',
                winPlayersMap: inuPlayersMap,
                allPlayersRoleMap
            }
        }
    }

    return {
        isGameEnd: false,
        winType: null,
        winPlayersMap: new Map(),
        allPlayersRoleMap: new Map()
    };
}

function calcPlayerId(tableId, displayName, twitterId) {
   return tableId + '' + displayName + '' + twitterId;
}

function calcChatId(tableId, displayName, chatText, chatTime) {
   return tableId + '' + displayName + '' + chatText + '' + chatTime;
}

function calcPrivateChatId(tableId, displayName, privateChatText, sendPlayerRole, chatTime) {
    return 'P' + tableId + displayName + privateChatText + sendPlayerRole + chatTime;
}

module.exports = {
    newConnection,
    getPlayersList,
    gotChatText,
    gotPrivateChatText,
    entryConnection,
    registerEntryRootIo,
    registerTablesRootIo,
    morningVoted,
    runoffElectionVoted,
    werewolfVoted,
    tellFortunes,
    protect
};