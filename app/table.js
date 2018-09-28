'use strict';
import io from 'socket.io-client';
import $ from 'jquery';

const clientObj = {
    displayName: $('#dataDiv').attr('data-displayName'),
    thumbUrl: $('#dataDiv').attr('data-thumbUrl'),
    ipAddress: $('#dataDiv').attr('data-ipAddress'),
    tableId: $('#dataDiv').attr('data-tableId')
};

const socket = io(`${clientObj.ipAddress}/table${clientObj.tableId}`);
const canvas = $('#mainCanvas')[0];
canvas.width = 560;
canvas.height = 160;
const ctx = canvas.getContext('2d');


socket.on('start data', (startObj) => {
    console.log(startObj);
});


socket.on('disconnect', () => {
    socket.disconnect();
});