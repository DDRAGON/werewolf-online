function createTableSocketServer(io, game) {

    const tableSocketsMap = new Map();

    for (let tableId = 1; tableId <= 16; tableId++) {

        const rootIo = io.of(`/table${tableId}`);
        rootIo.on('connection', function (socket) {

            const startObj = game.newConnection(socket.id);
            socket.emit('start data', startObj);

            /*

            socket.on('user data', (userData) => {
                game.updateUserData(socket.id, userData.displayName, userData.thumbUrl);
            });

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