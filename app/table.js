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
    resultsOfFortuneTellingMap: new Map(),
    deadPlayersColorMap: new Map(),
    killedPlayersMap: new Map(),
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
    clientObj.myPlayerId = startObj.yourPlayerId;
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
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('Hi fortune teller, night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.players = new Map(data.playersForFortuneTellerMap);
    clientObj.tellFortunesName = null; // 投票のリセット
    drawPlayersListInNightForFortuneTeller(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('Hi hunter, night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.protectName = null; // 守り先のリセット
    drawPlayersListInNightForHunter(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('Hi goast, night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.deadPlayersColorMap = new Map(data.deadPlayersColorMap);
    drawPlayersListWithVote(clientObj.players);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('Hi werewolf, night has come', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.werewolfVoteName = null; // 投票のリセット
    const playersWithoutWerewolfMap = new Map(data.playersWithoutWerewolfMap);
    drawPlayersListWithVoteAndWerewolf(clientObj.players, playersWithoutWerewolfMap);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('result of fortune telling', (data) => {
    clientObj.resultsOfFortuneTellingMap.set(clientObj.day, data);
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
});

socket.on('night result', (data) => {
    clientObj.time = data.time;
    clientObj.nextEventTime = data.nextEventTime;
    clientObj.players = new Map(data.playersList);
    clientObj.killedPlayersMap = new Map(data.killedPlayersMap);
    drawPlayersList(clientObj.players);
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
   if (clientObj.role === '霊能者') {
       players = setDeadColor(players);
   }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;

        let displayText = `💀 ${player.displayName}`;
        if (player.color && player.color === '白') {
            displayText = '○' + displayText;
        } else if (player.color && player.color === '黒') {
            displayText = '●' + displayText;
        }
        $('<div>', {
            id: playerId,
            text: displayText,
            class: 'dead'
        }).appendTo('#participants');
    }
}

function setDeadColor(players) {
    for (let [playerId, player] of players) {
        if (player.isAlive === false && clientObj.deadPlayersColorMap.has(playerId)) {
            player.color = clientObj.deadPlayersColorMap.get(playerId);
        }
    }
    return players;
}

function drawPlayersListWithVote(players) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');
    for (let [playerId, player] of players) {
        if (player.isAlive === false) continue;

        let playerNameText = player.displayName;
        if (player.color && player.color === '白') {
            playerNameText = '○' + playerNameText;
        } else if (player.color && player.color === '黒') {
            playerNameText = '●' + playerNameText;
        }
        $('<div>', {
            id: playerId,
            text: playerNameText,
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

    if (clientObj.role === '霊能者') {
        players = setDeadColor(players);
    }
    for (let [playerId, player] of players) {
        if (player.isAlive === true) continue;

        if (player.color && player.color === '白') {
            $('<div>', {
                id: playerId,
                text: `○💀 ${player.displayName}`,
                class: 'dead'
            }).appendTo('#participants');
        } else if (player.color && player.color === '黒') {
            $('<div>', {
                id: playerId,
                text: `●💀 ${player.displayName}`,
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

function drawPlayersListInNightForFortuneTeller(playersForFortuneTellerMap) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');
    for (let [playerId, player] of playersForFortuneTellerMap) {
        if (player.isAlive === false) continue;

        let playerNameText = player.displayName;
        if (player.color && player.color === '白') {
            playerNameText = '○' + playerNameText;
        } else if (player.color && player.color === '黒') {
            playerNameText = '●' + playerNameText;
        }

        if (playerId === clientObj.myPlayerId) { // 自分自身は占うことができない。

            $('<div>', {
                id: playerId,
                text: player.displayName,
                class: 'alive'
            }).appendTo('#participants');

        } else {

            $('<div>', {id: `${playerId}div`}).appendTo('#participants');
            $('<button>', {
                id: playerId,
                text: playerNameText,
                class: 'alive voteButton'
            }).appendTo(`#${playerId}div`);
            $("#" + playerId).click(function(){
                tellFortunes(playerId, player.displayName);
            });
        }

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

    for (let [playerId, player] of playersForFortuneTellerMap) {
        if (player.isAlive === true) continue;

        if (player.color && player.color === '白') {
            $('<div>', {
                id: playerId,
                text: `◯💀 ${player.displayName}`,
                class: 'dead'
            }).appendTo('#participants');
        } else if (player.color && player.color === '黒') {
            $('<div>', {
                id: playerId,
                text: `●💀 ${player.displayName}`,
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

function drawPlayersListInNightForHunter(players) {
    $('#participants').empty();
    $('<div>', {text: '参加者一覧'}).appendTo('#participants');
    for (let [playerId, player] of players) {
        if (player.isAlive === false) continue;

        if (playerId === clientObj.myPlayerId) { // 自分自身は守ることができない。

            $('<div>', {
                id: playerId,
                text: player.displayName,
                class: 'alive'
            }).appendTo('#participants');

        } else {

            $('<div>', {id: `${playerId}div`}).appendTo('#participants');
            $('<button>', {
                id: playerId,
                text: playerNameText,
                class: 'alive voteButton'
            }).appendTo(`#${playerId}div`);
            $("#" + playerId).click(function(){
                protect(playerId, player.displayName);
            });
        }

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

        $('<div>', {
            id: playerId,
            text: `💀 ${player.displayName}`,
            class: 'dead'
        }).appendTo('#participants');

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

    drawPlayersListWithVote(clientObj.players); // プレーヤー名の表示を元に戻す
    clientObj.werewolfVoteName = displayName;
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    socket.emit('werewolf vote', playerId);
}

function tellFortunes(playerId, displayName) {
    if (clientObj.tellFortunesName) return;

    drawPlayersListWithVote(clientObj.players); // プレーヤー名の表示を元に戻す
    clientObj.tellFortunesName = displayName;
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    socket.emit('tell fortunes', playerId);
}

function protect(playerId, displayName) {
    if (clientObj.protectName) return;

    drawPlayersListWithVote(clientObj.players); // プレーヤー名の表示を元に戻す
    clientObj.protectName = displayName;
    displayGaming(clientObj.day, clientObj.time, clientObj.nextEventTime);
    socket.emit('protect', playerId);
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

        ctx.fillStyle = "#FFD700";
        ctx.arc(100, 100, 30, 0 * Math.PI / 180, 360 * Math.PI / 180);
        ctx.fill();

        ctx.fillStyle = "midnightblue";
        ctx.arc(80, 80, 20, 0 * Math.PI / 180, 360 * Math.PI / 180);
        ctx.fill();

    } else if (time === 'nightResultMorning') {

    }


    if (time === 'morning') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  朝  朝会議の残り時間 ${remainTimeText}`, 10, 22);
    }

    if (time === 'morningVote') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day} 投票の残り時間 ${remainTimeText}`, 10, 22);
        if (clientObj.voteName) { // 投票先が決まったなら
            ctx.font = "32px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`「${clientObj.voteName}」に投票`, 10, 120);
        }
    }

    if (time === 'morningVoteResult') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  結果発表 ${remainTimeText}`, 10, 22);
        for ([playerId, votedPlayer] of clientObj.suspendedPlayers) {
            ctx.font = "18px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`${votedPlayer.displayName} さんの処刑が決定いたしました。`, 10, 120);
        }
    }

    if (time === 'morningVoteResultAndNextIsRunoffElection') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  結果発表 ${remainTimeText}`, 10, 22);
        ctx.font = "18px 'ＭＳ Ｐゴシック'";
        ctx.fillText(`票が多かった ${clientObj.suspendedPlayers.size} 名で決選投票を行います。`, 10, 120);
    }

    if (time === 'runoffElection') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  決戦投票  残り時間 ${remainTimeText}`, 10, 22);
        if (clientObj.runoffElectionVoteName) { // 投票先が決まったなら
            ctx.font = "32px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`「${clientObj.runoffElectionVoteName}」に投票`, 10, 120);
        }
    }

    if (time === 'runoffElectionResult') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day}  決戦投票結果発表  ${remainTimeText}`, 10, 22);
        for ([playerId, votedPlayer] of clientObj.suspendedPlayers) {
            ctx.font = "18px 'ＭＳ Ｐゴシック'";
            ctx.fillStyle = "black";
            ctx.fillText(`${votedPlayer.displayName} さんの処刑が決定いたしました。`, 10, 120);
        }
    }

    if (time === 'night') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "white";
        ctx.fillText(`Day ${day} 夜  残り時間 ${remainTimeText}`, 10, 22);

        if (clientObj.werewolfVoteName) { // 投票先が決まったなら（狼の場合）
            ctx.font = "32px 'ＭＳ Ｐゴシック'";
            ctx.fillText(`「${clientObj.werewolfVoteName}」に投票`, 10, 120);
        }

        if (!clientObj.resultsOfFortuneTellingMap.has(clientObj.day)) {
            if (clientObj.tellFortunesName) { // 占い先が決まったなら（占い師の場合）
                ctx.font = "32px 'ＭＳ Ｐゴシック'";
                ctx.fillText(`「${clientObj.tellFortunesName}」を占っています。`, 10, 120);
            }
        } else { // 占い結果がでたなら
            const resultOfFortuneTelling = clientObj.resultsOfFortuneTellingMap.get(clientObj.day);

            ctx.font = "36px 'ＭＳ Ｐゴシック'";
            ctx.fillText(`「${resultOfFortuneTelling.displayName}」を占った結果は`, 10, 120);
            ctx.fillText(`${resultOfFortuneTelling.color} でした。`, 40, 150);
        }
    }

    if (time === 'nightResultMorning') {
        ctx.font = "20px 'ＭＳ Ｐゴシック'";
        ctx.fillStyle = "black";
        ctx.fillText(`Day ${day} 早朝  残り時間 ${remainTimeText}`, 10, 22);
        ctx.font = "18px 'ＭＳ Ｐゴシック'";
        ctx.fillText(`おはようございます。`, 100, 45);
        if (clientObj.killedPlayersMap.size === 0) {
            ctx.fillText(`昨晩の犠牲者はいませんでした。`, 40, 70);
        } else {
            ctx.fillText(`昨晩の犠牲者は`, 40, 70);
            let positionY = 95;
            for ([killedPlayerId, killedPlayer] of clientObj.killedPlayersMap) {
                ctx.fillText(killedPlayer.displayName, 20, positionY);
                positionY += 25;
            }
            ctx.fillText(`でした。`, 40, positionY);
        }

        if (clientObj.resultsOfFortuneTellingMap.has(clientObj.day)) {
            const resultOfFortuneTelling = clientObj.resultsOfFortuneTellingMap.get(clientObj.day);
            ctx.font = "12px 'ＭＳ Ｐゴシック'";
            ctx.fillText(`占い師さん、${resultOfFortuneTelling.displayName} は ${resultOfFortuneTelling.color} でした。`, 5, 155);
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