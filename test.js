var dateJs = require('datejs');

var startDate = new Date()

var endDate = new Date(startDate).add(2).hours()

var difference = (endDate - startDate)/1000/60/60;

console.log('This is startDate ' + startDate, 'This is endDate ' + endDate);

console.log('This is the differece ', difference);
