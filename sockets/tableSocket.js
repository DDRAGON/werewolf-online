function createTableSocketServer(io, game) {

    const tableSocketsMap = new Map();

    for (let tableId = 1; tableId <= 16; tableId++) {

        const rootIo = io.of(`/table${tableId}`);
        rootIo.on('connection', function (socket) {

           const displayName = socket.handshake.query.displayName;
           const thumbUrl = socket.handshake.query.thumbUrl;
           const twitterId = socket.handshake.query.twitterId;

           if (!displayName || !thumbUrl || !twitterId) { // バリデーション
              socket.disconnect();
              return;
           }

           const startObj = game.newConnection(socket.id, tableId, displayName, thumbUrl, twitterId);
           socket.emit('start data', startObj);
           rootIo.emit('players list', game.getPlayersList(tableId));

           socket.on('chat text', (chatText) => {
               const chatObj = game.gotChatText(socket.id, tableId, displayName, thumbUrl, chatText);
               rootIo.emit('new chat', chatObj);
           });

       /*

           socket.on('change direction', (direction) => {
               game.updatePlayerDirection(socket.id, direction);
           });

           socket.on('missile emit', (direction) => {
               game.missileEmit(socket.id, direction);
           });

           socket.on('disconnect', () => {
               game.disconnect(socket.id);
           });
           */
        });

        tableSocketsMap.set(tableId, rootIo);
    }
}

module.exports = {
    createTableSocketServer
};