const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo");

const tables = [];
for (let tableId = 1; tableId <= 16; tableId++) {
   const table = {
       players: new Map(),
       playerBySockets: new Map(),
       AIs: new Map(),
       chats: new Map(),
       tableState: 'waiting'
   };

    const dt = new Date();
    dt.setMinutes(dt.getMinutes() + 1 + (tableId-1)*10);
    table.startTime = dt.getTime();

    setTimeout(function() {startGame(tableId);}, dt.getTime() - new Date().getTime()); // ゲーム開始時刻の設定
   tables[tableId] = table;
}

const gameObj = {
   tables: tables
};


function newConnection(socketId, tableId, displayName, thumbUrl, twitterId) {

   const table = gameObj.tables[tableId];
   const playerId = calcPlayerId(tableId, displayName, twitterId);

   if (!table.players.has(playerId)) {
       // new player
       const player = {
           tableId,
           displayName,
           thumbUrl,
           twitterId,
           socketId
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
       }
   }

   return {
      chats: Array.from(table.chats),
       startTime:  table.startTime,
       tableState: table.tableState
   };
}

function getPlayersList(tableId) {
    const playersList = new Map();
    for ([playerId, player] of gameObj.tables[tableId].players) {
        playersList.set(playerId, {
            playerId,
            displayName: player.displayName,
            type: 'player'
        });
    }
    for ([aiId, ai] of gameObj.tables[tableId].AIs) {
        playersList.set(aiId, {
            aiId,
            displayName: ai.displayName,
            type: 'AI'
        });
    }
   return Array.from(playersList);
}

function gotChatText(socketId, tableId, displayName, thumbUrl, chatText) {
   console.log({socketId, tableId, displayName, thumbUrl, chatText});
   const chatTime = new Date().getTime();
   const chatId = calcChatId(tableId, displayName, chatText, chatTime);
   const chatObj = {
      chatId,
      chatText,
      displayName,
      thumbUrl,
      chatTime
   };
   const table = gameObj.tables[tableId];
   table.chats.set(chatId, chatObj);
   return chatObj;
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
    tables[tableId].tableState = 'gaming';
    const tablesInfo = entryConnection();
    gameObj.EntryRootIo.emit('tables data', tablesInfo);

    addAIs(tableId); // AI の追加
    addRoles(tableId); // 役職決め

    console.log(tables[tableId].playerBySockets);
    console.log(tables[tableId].players);
    for ([socketId, player] of tables[tableId].playerBySockets) {
        const playerId = player.playerId;
        const role = tables[tableId].players.get(playerId).role;
        gameObj.tableSocketsMap.get(tableId).to(socketId).emit('your role', role);
    }
    gameObj.tableSocketsMap.get(tableId).emit('game start', {});
    gameObj.tableSocketsMap.get(tableId).emit('players list', getPlayersList(tableId));
}

function registerEntryRootIo(rootIo){
    gameObj.EntryRootIo = rootIo;
}

function registerTablesRootIo(tableSocketsMap) {
    gameObj.tableSocketsMap = tableSocketsMap;
}

function addAIs(tableId) {
    for(let aiId = 1; aiId <= (10 - gameObj.tables[tableId].players.size); aiId++) {
        const ai = {
            tableId,
            displayName: `AI${aiId}`,
            thumbUrl: null,
            twitterId: `AI${aiId}`
        };
        tables[tableId].AIs.set(`AI${aiId}`, ai);
    }
}

function addRoles(tableId) {
    const numOfPlayers = gameObj.tables[tableId].players.size + gameObj.tables[tableId].AIs.size;
    const rolesArray = createRolesArray(numOfPlayers);
    for ([socketId, player] of gameObj.tables[tableId].players) {
        const roleIndex = Math.floor(Math.random() * rolesArray.length);
        player.role = rolesArray[roleIndex];
        rolesArray.splice(roleIndex, 1);
    }
    for ([aiId, ai] of gameObj.tables[tableId].AIs) {
        const roleIndex = Math.floor(Math.random() * rolesArray.length);
        ai.role = rolesArray[roleIndex];
        rolesArray.splice(roleIndex, 1);
    }
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

function calcPlayerId(tableId, displayName, twitterId) {
   return tableId +',' + displayName + ',' + twitterId;
}

function calcChatId(tableId, displayName, chatText, chatTime) {
   return tableId +',' + displayName + ',' + chatText + ',' + chatTime;
}

module.exports = {
    newConnection,
    getPlayersList,
    gotChatText,
    entryConnection,
    registerEntryRootIo,
    registerTablesRootIo
};