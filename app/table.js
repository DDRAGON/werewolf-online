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
    chatAutoScroll: true,
    privateChatAutoScroll: true,
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

function setPrivateChatClick() {
    $('#privateChatButton').click(function() {
        const inputValue = $('#privateChatInput').val();
        $('#privateChatInput').val(''); // 空にする
        if (inputValue == "") { return; } // 何もしない

        const escapedSendMessage = $('<p/>').text(inputValue).html();// エスケープ
        socket.emit('private chat text', escapedSendMessage);
    });

    $('#privateChat').on('scroll', function(){
        clientObj.privateChatAutoScroll = false;
        const scrollHeight = $('#privateChat').get(0).scrollHeight; // 要素の大きさ
        const scrollBottom = $('#privateChat').scrollTop() + $('#privateChat').innerHeight();
        if (scrollHeight <= (scrollBottom + 5)) {
            clientObj.privateChatAutoScroll = true;
        }
    });
}


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

socket.on('new private chat', (privateChatObj) => {
    addPrivateChat(privateChatObj);
});

socket.on('your role', (myRole) => {
    clientObj.role = myRole;
    displayRole(myRole);
});

socket.on('game start', (data) => {
    clientObj.players = new Map(data.playersList);
    clientObj.day = data.day;
    clientObj.time = data.time;
    clientObj.tableState = data.tableState;
    clientObj.nextEventTime = data.nextEventTime;
    drawPlayersList(clientObj.players);
});

socket.on('morning vote start', (data) => {
    clientObj.players = new Map(data.playersList);
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.voteName = null;
    drawMorningVotePlayersList(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('morning vote result', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.players = new Map(data.playersList);
    clientObj.suspendedPlayers = new Map(data.suspendedPlayers);
    drawPlayersListWithVote(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('runoff election start', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.players = new Map(data.playersList);
    clientObj.suspendedPlayers = new Map(data.suspendedPlayers);
    clientObj.runoffElectionVoteName = null;
    drawRunoffElectionPlayersList(clientObj.players, clientObj.suspendedPlayers);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('runoff election result', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.players = new Map(data.playersList);
    clientObj.suspendedPlayers = new Map(data.suspendedPlayers);
    drawPlayersListWithVote(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    drawPlayersListWithVote(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('Hi goast, night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    const deadPlayersColorMap = new Map(data.deadPlayersColorMap);
    drawPlayersListWithVoteAndGoast(clientObj.players, deadPlayersColorMap);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('Hi werewolf, night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    const playersWithoutWerewolfMap = new Map(data.playersWithoutWerewolfMap);
    drawPlayersListWithVoteAndWerewolf(clientObj.players, playersWithoutWerewolfMap);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});


function drawPlayersList(players) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');
   for (let [playerId, player] of players) {
       if (player.isAlive === false) continue;
      $('<div>', {
         id: playerId,
         text: player.displayName,
          class: 'alive'
      }).appendTo('#participants');
   }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;
        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'dead'
        }).appendTo('#participants');
    }
}

function drawPlayersListWithVote(players) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');
    for (let [playerId, player] of players) {
        if (player.isAlive === false) continue;
        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'alive'
        }).appendTo('#participants');
        if (player.votedto.voteMethod === 'random') {
            $('<span>', {
                text: `　投票先: ${player.votedto.displayName}（ランダム）`,
                class: 'voteSpan'
            }).appendTo(`#${playerId}`);
        } else {
            $('<span>', {
                text: `　投票先: ${player.votedto.displayName}`,
                class: 'voteSpan'
            }).appendTo(`#${playerId}`);
        }
        if (player.runoffElectionVotedto) {
            if (player.runoffElectionVotedto.voteMethod === 'random') {
                $('<span>', {
                    text: `　決選投票: ${player.runoffElectionVotedto.displayName}（ランダム）`,
                    class: 'voteSpan'
                }).appendTo(`#${playerId}`);
            } else {
                $('<span>', {
                    text: `　決選投票: ${player.runoffElectionVotedto.displayName}`,
                    class: 'voteSpan'
                }).appendTo(`#${playerId}`);
            }
        }
    }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;

        if (player.color && player.color === '白') {
            $('<div>', {
                id: playerId,
                text: `💀 □${player.displayName}`,
                class: 'dead'
            }).appendTo('#participants');
        } else if (player.color && player.color === '黒') {
            $('<div>', {
                id: playerId,
                text: `💀 ■${player.displayName}`,
                class: 'dead'
            }).appendTo('#participants');
        } else {
            $('<div>', {
                id: playerId,
                text: `💀 ${player.displayName}`,
                class: 'dead'
            }).appendTo('#participants');
        }
    
        if (player.votedto) {
            if (player.votedto.voteMethod === 'random') {
                $('<span>', {
                    text: `　投票先: ${player.votedto.displayName}（ランダム）`,
                    class: 'voteSpan'
                }).appendTo(`#${playerId}`);
            } else {
                $('<span>', {
                    text: `　投票先: ${player.votedto.displayName}`,
                    class: 'voteSpan'
                }).appendTo(`#${playerId}`);
            }
        }
        if (player.runoffElectionVotedto) {
            if (player.runoffElectionVotedto.voteMethod === 'random') {
                $('<span>', {
                    text: `　決選投票: ${player.runoffElectionVotedto.displayName}（ランダム）`,
                    class: 'voteSpan'
                }).appendTo(`#${playerId}`);
            } else {
                $('<span>', {
                    text: `　決選投票: ${player.runoffElectionVotedto.displayName}`,
                    class: 'voteSpan'
                }).appendTo(`#${playerId}`);
            }
        }
    }
}

function drawPlayersListWithVoteAndGoast(players, deadPlayersColorMap) {
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;

        player.color = deadPlayersColorMap.get(playerId);
    }
    drawPlayersListWithVote(players);
}

function drawPlayersListWithVoteAndWerewolf(players, playersWithoutWerewolfMap) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');

    for (let [playerId, player] of playersWithoutWerewolfMap) {
        $('<div>', {id: `${playerId}div`}).appendTo('#participants');
        $('<button>', {
            id: playerId,
            text: player.displayName,
            class: 'alive voteButton'
        }).appendTo(`#${playerId}div`);
        $("#" + playerId).click(function(){
            werewolfVote(playerId, player.displayName);
        });
    }

    for (let [playerId, player] of players) {
        if (player.isAlive === false) continue;
        if (playersWithoutWerewolfMap.has(playerId)) continue;

        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'alive'
        }).appendTo('#participants');
    }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;
        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'dead'
        }).appendTo('#participants');
    }
}

function drawMorningVotePlayersList(players) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');

    for (let [playerId, player] of players) {
        if (player.isAlive === false) continue;
        $('<div>', {id: `${playerId}div`}).appendTo('#participants');
        $('<button>', {
            id: playerId,
            text: player.displayName,
            class: 'alive voteButton'
        }).appendTo(`#${playerId}div`);
        $("#" + playerId).click(function(){
            morningVote(playerId, player.displayName);
        });
    }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;
        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'dead'
        }).appendTo('#participants');
    }
}

function morningVote(playerId, displayName) {
    if (clientObj.voteName) return;

    drawPlayersList(clientObj.players); // プレーヤー名の表示を元に戻す
    clientObj.voteName = displayName;
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    socket.emit('morning vote', playerId);
}

function werewolfVote(playerId, displayName) {
    if (clientObj.werewolfVoteName) return;

    drawPlayersList(clientObj.players); // プレーヤー名の表示を元に戻す
    clientObj.werewolfVoteName = displayName;
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    socket.emit('werewolf vote', playerId);
}

function drawRunoffElectionPlayersList(players, suspendedPlayers) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');

    for (let [suspendedPlayerId, suspendedPlayer] of suspendedPlayers) {
        $('<div>', {id: `${suspendedPlayerId}div`}).appendTo('#participants');
        $('<button>', {
            id: suspendedPlayerId,
            text: suspendedPlayer.displayName,
            class: 'alive voteButton'
        }).appendTo(`#${suspendedPlayerId}div`);
        $("#" + suspendedPlayerId).click(function(){
            runoffElectionVote(suspendedPlayerId, suspendedPlayer.displayName);
        });
    }

    for (let [playerId, player] of players) {
        if (player.isAlive === false) continue;
        if (suspendedPlayers.has(playerId)) continue;

        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'alive'
        }).appendTo('#participants');
    }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;

        $('<div>', {
            id: playerId,
            text: player.displayName,
            class: 'dead'
        }).appendTo('#participants');
    }
}

function runoffElectionVote(suspendedPlayerId, displayName) {
    if (clientObj.runoffElectionVoteName) return;

    drawPlayersList(clientObj.players); // プレーヤー名の表示を元に戻す
    clientObj.runoffElectionVoteName = displayName;
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    socket.emit('runoff election vote', suspendedPlayerId);
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

function addPrivateChat(privateChatObj) {
    const addHTML = `
<p id="${privateChatObj.privateChatId}">
   <img src="${privateChatObj.thumbUrl}" align="left">
   <span>${privateChatObj.displayName}</span>
   <span>${privateChatObj.chatTime}</span>
   <br>
   <span>${privateChatObj.privateChatText}</span>
</p>`;

    $('#privateChat').append(addHTML);

    if (clientObj.privateChatAutoScroll === true) {
        $('#privateChat').scrollTop($('#privateChat').get(0).scrollHeight);
    }
}

function displayRole(role) {
    $('#roleArea').empty();
    $('#explainArea').empty();
    $('#privateChatBox').empty();
    $('#submitPrivateChat').empty();
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
           $('<div>', {text:'共有者', class:'shares'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは共有者です。<br>勝利条件は人狼と妖狐（存在する場合は）を全滅させることです。<br>共有者同士は常に会話ができます。`);
           $('<div>', {id:'privateChat'}).appendTo('#privateChatBox');
           $('<div>', {id:'submitPrivateChat'}).appendTo('#privateChatBox');
           $('<input>', {id:'privateChatInput'}).appendTo('#submitPrivateChat');
           $('<button>', {id:'privateChatButton', text: '送信'}).appendTo('#submitPrivateChat');
           setPrivateChatClick();
           break;
       case '妖狐':
           $('<div>', {text:'妖狐', class:'inu'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは妖狐です。<br>勝利条件は、村人または人狼が勝利条件を満たしゲームが終了した時に生き残っていることです。<br>妖狐同士は常に会話ができます。`);
           $('<div>', {id:'privateChat'}).appendTo('#privateChatBox');
           $('<div>', {id:'submitPrivateChat'}).appendTo('#privateChatBox');
           $('<input>', {id:'privateChatInput'}).appendTo('#submitPrivateChat');
           $('<button>', {id:'privateChatButton', text: '送信'}).appendTo('#submitPrivateChat');
           setPrivateChatClick();
           break;
       case '人狼':
           $('<div>', {text:'人狼', class:'werewolf'}).appendTo('#roleArea');
           $('#explainArea').html(`あなたは人狼です。<br>勝利条件は生き残った人間の数よりも、狂人と人狼を合わせた数が同じかそれ以上になると勝利です。<br>夜の間に人を一人指定し殺すことができます。（ただし、妖狐や狩人に守られている人は殺せません）<br>人狼同士は常に会話ができます。`);
           $('<div>', {id:'privateChat'}).appendTo('#privateChatBox');
           $('<div>', {id:'submitPrivateChat'}).appendTo('#privateChatBox');
           $('<input>', {id:'privateChatInput'}).appendTo('#submitPrivateChat');
           $('<button>', {id:'privateChatButton', text: '送信'}).appendTo('#submitPrivateChat');
           setPrivateChatClick();
           break;
   }
}

function displayWaiting(startTime) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    const remainTimeText = calcRemainTime(startTime);
    if (remainTimeText !== '') {
        ctx.font = "40px 'ＭＳ Ｐゴシック'";
        ctx.fillText('開始時刻 ' + moment(startTime).tz('Asia/Tokyo').format('HH時:mm分'), 70, 60);
        ctx.fillText('あと' + calcRemainTime(startTime), 120, 120);
    } else {
        ctx.font = "50px 'ＭＳ Ｐゴシック'";
        ctx.fillText('ゲーム開始', 70, 120);
    }

}

function displayGaming(day, time, nextEventTime) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const remainTimeText = calcRemainTime(nextEventTime);
    if (
        time === 'morning' ||
        time === 'morningVote' ||
        time === 'morningVoteResult' ||
        time === 'morningVoteResultAndNextIsRunoffElection' ||
        time === 'runoffElection' ||
        time === 'runoffElectionResult'
    ) {

        ctx.fillStyle = "lightcyan";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "orangered";
        ctx.arc(100, 100, 30, 0 * Math.PI / 180, 360 * Math.PI / 180);
        ctx.fill();

    } else if (time === 'night') {

        ctx.fillStyle = "midnightblue";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "gold";
        ctx.arc(100, 100, 30, 0 * Math.PI / 180, 360 * Math.PI / 180);
        ctx.fill();

        ctx.fillStyle = "midnightblue";
        ctx.arc(90, 100, 30, 0 * Math.PI / 180, 360 * Math.PI / 180);
        ctx.fill();
    }


    if (time === 'morning') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  ${time}  朝会議の残り時間 ${remainTimeText}`, 10, 22);
    }

    if (time === 'morningVote') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  ${time}  投票の残り時間 ${remainTimeText}`, 10, 22);
        if (clientObj.voteName) { // 投票先が決まったなら
            ctx.font = "32px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`「${clientObj.voteName}」に投票`, 10, 120);
        }
    }

    if (time === 'morningVoteResult') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  ${time}  結果発表 ${remainTimeText}`, 10, 22);
        for ([playerId, votedPlayer] of clientObj.suspendedPlayers) {
            ctx.font = "18px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`${votedPlayer.displayName} さんの処刑が決定いたしました。`, 10, 120);
        }
    }

    if (time === 'morningVoteResultAndNextIsRunoffElection') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  ${time}  結果発表 ${remainTimeText}`, 10, 22);
        ctx.font = "18px 'ＭＳ Ｐゴシック'";
        ctx.fillText(`票が多かった ${clientObj.suspendedPlayers.size} 名で決選投票を行います。`, 10, 120);
    }

    if (time === 'runoffElection') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  ${time}  決戦投票の残り時間 ${remainTimeText}`, 10, 22);
        if (clientObj.runoffElectionVoteName) { // 投票先が決まったなら
            ctx.font = "32px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`「${clientObj.runoffElectionVoteName}」に投票`, 10, 120);
        }
    }

    if (time === 'runoffElectionResult') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  ${time}  結果発表 ${remainTimeText}`, 10, 22);
        for ([playerId, votedPlayer] of clientObj.suspendedPlayers) {
            ctx.font = "18px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`${votedPlayer.displayName} さんの処刑が決定いたしました。`, 10, 120);
        }
    }

    if (time === 'night') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day} 夜の残り時間 ${remainTimeText}`, 10, 22);

        if (clientObj.werewolfVoteName) { // 投票先が決まったなら（狼の場合）
            ctx.font = "32px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`「${clientObj.werewolfVoteName}」に投票`, 10, 120);
        }
    }
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
    } else if (clientObj.tableState && clientObj.tableState === 'gaming') {
        displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    }

}, 1000); // タイマー