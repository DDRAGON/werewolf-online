'use strict';
import io from 'socket.io-client';
import $ from 'jquery';
import moment from "moment-timezone";

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

    clientObj.tableState = startObj.tableState;
    clientObj.startTime = startObj.startTime;
});

socket.on('players list', (playersArray) => {
   clientObj.players = new Map(playersArray);
   drawPlayersList(clientObj.players);
});

socket.on('new chat', (chatObj) => {
   addChat(chatObj);
});

socket.on('your role', (myRole) => {
    clientObj.role = myRole;
    displayRole(myRole);
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

function displayRole(role) {
   console.log(role);
   switch (role) {
       case '村人':
           $('<div>', {text:'村人', class:'villager'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは村人です。<br>勝利条件は人狼と妖狐（存在する場合は）を全滅させることです。<br>他の村人達と協力して人狼をあばき出し、処刑しましょう。`);
           break;
       case '占い師':
           $('<div>', {text:'占い師', class:'fortuneTeller'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは占い師です。<br>勝利条件は人狼と妖狐（存在する場合は）を全滅させることです。<br>夜の間に一人を選んで占うことができます。妖狐を占うとその妖狐は死にます。`);
           break;
       case '霊能者':
           $('<div>', {text:'霊能者', class:'psychic'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは霊能者です。<br>勝利条件は人狼と妖狐（存在する場合は）を全滅させることです。<br>夜の間に昨日処刑された人が人間か人狼を知ることができます。`);
           break;
       case '狩人':
           $('<div>', {text:'狩人', class:'hunter'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは狩人です。<br>勝利条件は人狼と妖狐（存在する場合は）を全滅させることです。<br>夜の間に誰か一人を指名し、狼から守ることができます。`);
           break;
       case '狂人':
           $('<div>', {text:'狂人', class:'madman'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは狂人です。<br>勝利条件は生き残った人間の数よりも、狂人と人狼を合わせた数が同じかそれ以上になると勝利です。<br>能力は特にありませんが、人狼勝利が同時に狂人の勝利でもあります。`);
           break;
       case '共有者':
           $('#explainArea').html(`あなたは共有者です。<br>勝利条件は人狼と妖狐（存在する場合は）を全滅させることです。<br>共有者同士は常に会話ができます。`);
           $('<div>', {text:'共有者', class:'shares'}).appendTo('#roleArea');
           $('<div>', {id:'privateChat'}).appendTo('#privateChatBox');
           $('<div>', {id:'submitPrivateChat'}).appendTo('#privateChatBox');
           $('<input>', {id:'privateChatInput'}).appendTo('#submitPrivateChat');
           $('<button>', {id:'privateChatButton', text: '送信'}).appendTo('#submitPrivateChat');
           break;
       case '妖狐':
           $('#explainArea').html(`あなたは妖狐です。<br>勝利条件は、村人または人狼が勝利条件を満たしゲームが終了した時に生き残っていることです。<br>妖狐同士は常に会話ができます。`);
           $('<div>', {text:'妖狐', class:'inu'}).appendTo('#roleArea');
           $('<div>', {id:'privateChat'}).appendTo('#privateChatBox');
           $('<div>', {id:'submitPrivateChat'}).appendTo('#privateChatBox');
           $('<input>', {id:'privateChatInput'}).appendTo('#submitPrivateChat');
           $('<button>', {id:'privateChatButton', text: '送信'}).appendTo('#submitPrivateChat');
           break;
       case '人狼':
           $('#explainArea').html(`あなたは人狼です。<br>勝利条件は生き残った人間の数よりも、狂人と人狼を合わせた数が同じかそれ以上になると勝利です。<br>夜の間に人を一人指定し殺すことができます。（ただし、妖狐や狩人に守られている人は殺せません）<br>人狼同士は常に会話ができます。`);
           $('<div>', {text:'人狼', class:'werewolf'}).appendTo('#roleArea');
           $('<div>', {id:'privateChat'}).appendTo('#privateChatBox');
           $('<div>', {id:'submitPrivateChat'}).appendTo('#privateChatBox');
           $('<input>', {id:'privateChatInput'}).appendTo('#submitPrivateChat');
           $('<button>', {id:'privateChatButton', text: '送信'}).appendTo('#submitPrivateChat');
           break;
   }
}

function displayWaiting(startTime) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "40px 'ＭＳ Ｐゴシック'";
    ctx.fillStyle = "black";
    ctx.fillText('開始時刻 ' + moment(startTime).tz('Asia/Tokyo').format('HH時:mm分'), 70, 60);
    ctx.fillText('あと' + calcRemainTime(startTime), 120, 120);
}

function calcRemainTime(distTime) {
    const remainTime = distTime - new Date().getTime();
    const remainHour    = Math.floor(remainTime / (1000 * 60 * 60));
    const remainMinutes = Math.floor((remainTime % (1000 * 60 * 60)) / (1000 * 60));
    const remainSeconds = Math.floor((remainTime % (1000 * 60)) / (1000));

    let remainText = '';
    if (remainHour > 0) remainText += `${remainHour}時間`;
    if (remainMinutes > 0) remainText += `${remainMinutes}分`;
    if (remainSeconds > 0) remainText += `${remainSeconds}秒`;

    return remainText;
}

setInterval(function() {
    if (clientObj.tableState && clientObj.tableState === 'waiting') {
        displayWaiting(clientObj.startTime);
    }

}, 1000); // タイマー