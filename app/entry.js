'use strict';
import io from 'socket.io-client';
import $ from 'jquery';
import moment from 'moment-timezone';
moment.locale('ja');

const socket = io(`http://${location.host}/`);

const entryObj = {
    tablesInfo: []
};

for (let id = 1; id <= 16; id++) {

    $(`#join-button${id}`).click(function() {
        location.href = `table/${id}`;
    });

   $(`#watch-button${id}`).click(function() {
      location.href = `table/${id}?mode=watch`;
   });
}


socket.on('start data', (tablesInfo) => {
    entryObj.tablesInfo = tablesInfo;
    setInterval(reWriteStartTime, 1000);
});

socket.on('tables data', (tablesInfo) => {
    entryObj.tablesInfo = tablesInfo;
});

function reWriteStartTime(tablesInfo) {

    for (let tableId = 1; tableId <= 16; tableId++) {
        const startTime  = entryObj.tablesInfo[tableId].startTime;
        const tableState = entryObj.tablesInfo[tableId].tableState;

        if (tableState === `waiting`) {
            $('#time' + tableId).html('開始時刻 ' + moment(startTime).tz('Asia/Tokyo').format('HH時:mm分') + '<br>あと' + calcRemainTime(startTime));
        } else if (tableState === `gaming`) {
            $('#time' + tableId).text('ゲーム中');
            $(`#join-button${tableId}`).hide(); // 参加ボタンを消す
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