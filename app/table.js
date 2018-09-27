'use strict';
import io from 'socket.io-client';
import $ from 'jquery';

const socket = io($('#main').attr('data-ipAddress'));
const canvas = $('#mainCanvas')[0];
canvas.width = 560;
canvas.height = 160;
const ctx = canvas.getContext('2d');