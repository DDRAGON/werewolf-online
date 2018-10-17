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

   const player = {
      tableId,
      displayName,
      thumbUrl,
      twitterId
   };

   table.players.set(playerId, player);
   table.playerBySockets.set(socketId, player);
   //gameObj.tables[tableId] =  table;

   // トップページに送信
    const tablesInfo = entryConnection();
    gameObj.EntryRootIo.emit('tables data', tablesInfo);

   return {
      chats: Array.from(table.chats)
   };
}

function getPlayersList(tableId) {
   return Array.from(gameObj.tables[tableId].players);
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


    gameObj.tableSocketsMap.get(tableId).emit('game start', {});
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
    console.log({numOfPlayers, rolesArray, players: gameObj.tables[tableId].players, AIs: gameObj.tables[tableId].AIs});
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
    const numOfVillager = numOfPlayers - numOfWerewolfs - numOfMadmans - numOfShares - numOfInus - numOfHunters - 2; // 占い師と霊能者の数をひく

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