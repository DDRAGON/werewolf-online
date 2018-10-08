'use strict';
import $ from 'jquery';

for (let id = 1; id <= 16; id++) {

    $(`#join-button${id}`).click(function() {
        location.href = `table/${id}`;
        console.log('クリックされました！');
    });

   $(`#watch-button${id}`).click(function() {
      location.href = `table/${id}?mode=watch`;
      console.log('クリックされました！');
   });
}