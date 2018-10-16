const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo");

const tables = [];
for (let tableId = 1; tableId <= 16; tableId++) {
   const table = {
       players: new Map(),
       playerBySockets: new Map(),
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
   gameObj.tables[tableId] =  table;

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
            tableState: gameObj.tables[tableId].tableState
       };
   }

   return tablesInfo;
}

function startGame(tableId) {
    tables[tableId].tableState = 'gaming';
    const tablesInfo = entryConnection();
    gameObj.EntryRootIo.emit('tables data', tablesInfo);
}

function registerEntryRootIo(rootIo){
    gameObj.EntryRootIo = rootIo;
}

function registerTablesRootIo(tableSocketsMap) {
    gameObj.tableSocketsMap = tableSocketsMap;
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