const uuidv3 = require('uuid/v3');

const tables = [];
for (let i = 0; i <= 16; i++) {
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
      message: 'Hello!'
   };
}

function getPlayersList(tableId) {
   return Array.from(gameObj.tables[tableId].players);
}

function calcPlayerId(tableId, displayName, twitterId) {
   return tableId +',' + displayName + ',' + twitterId;
}

module.exports = {
   newConnection,
   getPlayersList
};