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
                game.gotChatText(socket.id, tableId, displayName, thumbUrl, chatText);
            });

            socket.on('private chat text', (privateChatText) => {
                game.gotPrivateChatText(socket.id, tableId, displayName, thumbUrl, privateChatText);
            });

            socket.on('morning vote', (playerId) => {
                game.morningVoted(socket.id, tableId, playerId);
            });

            socket.on('runoff election vote', (suspendedPlayerId) => {
                game.runoffElectionVoted(socket.id, tableId, suspendedPlayerId);
            });

            socket.on('werewolf vote', (playerId) => {
                game.werewolfVoted(socket.id, tableId, playerId);
            });

            socket.on('tell fortunes', (playerId) => {
                game.tellFortunes(socket.id, tableId, playerId);
            });

            socket.on('protect', (playerId) => {
                game.protect(socket.id, tableId, playerId);
            });

        });

        tableSocketsMap.set(tableId, rootIo);
    }

    game.registerTablesRootIo(tableSocketsMap);
}

module.exports = {
    createTableSocketServer
};