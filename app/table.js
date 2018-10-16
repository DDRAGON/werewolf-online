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
   players: new Map(),
   chatAutoScroll: true
};

const socketQueryParameters = `displayName=${clientObj.displayName}&thumbUrl=${clientObj.thumbUrl}&twitterId=${clientObj.twitterId}`;
const socket = io(`http://${location.host}/table${clientObj.tableId}?${socketQueryParameters}`);
const canvas = $('#mainCanvas')[0];
canvas.width = 560;
canvas.height = 160;
const ctx = canvas.getContext('2d');

$('#mainChatButton').click(function() {
   const inputValue = $('#mainChatInput').val();
   $('#mainChatInput').val(''); // 空にする
   if (inputValue == "") { return; } // 何もしない

   const escapedSendMessage = $('<p/>').text(inputValue).html();// エスケープ
   socket.emit('chat text', escapedSendMessage);
});

$('#mainChat').on('scroll', function(){
   clientObj.chatAutoScroll = false;
   const scrollHeight = $('#mainChat').get(0).scrollHeight; // 要素の大きさ
   const scrollBottom = $('#mainChat').scrollTop() + $('#mainChat').innerHeight();
   if (scrollHeight <= (scrollBottom + 5)) {
      clientObj.chatAutoScroll = true;
   }
});

socket.on('start data', (startObj) => {
   $('#mainChat').empty();
   const chats = new Map(startObj.chats);
   for ([chatId, chatObj] of chats) {
      addChat(chatObj);
   }
});

socket.on('players list', (playersArray) => {
   clientObj.players = new Map(playersArray);
   drawPlayersList(clientObj.players);
});

socket.on('new chat', (chatObj) => {
   addChat(chatObj);
});

function drawPlayersList(players) {
   $('#participants').empty();
   for (let [playerId, player] of players) {
      $('<div>', {
         id: playerId,
         text: player.displayName
      }).appendTo('#participants');
   }
}

function addChat(chatObj) {
   const addHTML = `
<p id="${chatObj.chatId}">
   <img src="${chatObj.thumbUrl}" align="left">
   <span>${chatObj.displayName}</span>
   <span>${chatObj.chatTime}</span>
   <br>
   <span>${chatObj.chatText}</span>
</p>`;

   $('#mainChat').append(addHTML);

   if (clientObj.chatAutoScroll === true) {
      $('#mainChat').scrollTop($('#mainChat').get(0).scrollHeight);
   }
}
