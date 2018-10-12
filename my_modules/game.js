const uuidv3 = require('uuid/v3');

const tables = [];
for (let i = 1; i <= 16; i++) {
   const table = {
      players: new Map(),
      playerBySockets: new Map(),
      chats: new Map()
   };
   tables[i] = table;
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
   }
   const table = gameObj.tables[tableId];
   table.chats.set(chatId, chatObj);
   return chatObj;
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
   gotChatText
};