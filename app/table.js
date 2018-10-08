'use strict';
import io from 'socket.io-client';
import $ from 'jquery';

const clientObj = {
   displayName: $('#dataDiv').attr('data-displayName'),
   thumbUrl: $('#dataDiv').attr('data-thumbUrl'),
   twitterId: $('#dataDiv').attr('data-twitterId'),
   ipAddress: $('#dataDiv').attr('data-ipAddress'),
   tableId: $('#dataDiv').attr('data-tableId'),
   participantsElement: $('#participants'),
   players: new Map()
};

const socketQueryParameters = `displayName=${clientObj.displayName}&thumbUrl=${clientObj.thumbUrl}&twitterId=${clientObj.twitterId}`;
const socket = io(`${clientObj.ipAddress}/table${clientObj.tableId}?${socketQueryParameters}`);
const canvas = $('#mainCanvas')[0];
canvas.width = 560;
canvas.height = 160;
const ctx = canvas.getContext('2d');


socket.on('start data', (startObj) => {
    // console.log(startObj);
});

socket.on('players list', (playersArray) => {
   clientObj.players = new Map(playersArray);
   drawPlayersList(clientObj.players);
});


socket.on('disconnect', () => {
    socket.disconnect();
});

function drawPlayersList(players) {
   for (let [playerId, player] of players) {
      $('<div>', {
         id: playerId,
         text: player.displayName
      }).appendTo('#participants');
   }
}
