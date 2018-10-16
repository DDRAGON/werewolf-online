function createEntrySocketServer(io, game) {

    const rootIo = io.of(`/`);
    rootIo.on('connection', function (socket) {

        const tablesInfo = game.entryConnection();
        socket.emit('start data', tablesInfo);
    });

    game.registerEntryRootIo(rootIo);
}

module.exports = {
    createEntrySocketServer
};