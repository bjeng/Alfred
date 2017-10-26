var readline = require('readline');
var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var dateJs = require('datejs');
var calendar = google.calendar('v3');
var User = require('../models');
//MAKE SURE TO REQURE THE BOT HERE

var SCOPES = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar';
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';
var OAuth2Client = google.OAuth2Client;
var client_id = process.env.client_id;
var client_secret = process.env.client_secret;
var redirect_uri = process.env.redirect_uri;
var auth = new googleAuth();
var oauth2Client = new auth.OAuth2(client_id, client_secret, redirect_uri);

//AUTHENTICATE
function authenticate(code, oauth2Client, id) {
  oauth2Client.getToken(code, function(err, token) {
    if (err) {
      console.log('Error while trying to retrieve access token', err);
      return;
    }
    oauth2Client.credentials = token;
    User.findOneAndUpdate({userId: id}, {token: token}, function(err) {
      if (err) {
        console.log('Did not update', err);
      } else {
        console.log('Successfully updated');
      }
    });
  });
}

//REMINDER
function makeReminder(token, title, date) {
  console.log('THIS IS THE MASTER AUTH',token)
  var newToken = new auth.OAuth2(client_id, client_secret, redirect_uri)
  newToken.credentials = token
  calendar.events.insert({
        auth: newToken,
        calendarId: 'primary',
        resource: {
          summary: title,
          start: {
            date: date ,
            timeZone: 'America/Los_Angeles',
          },
          end: {
            date: date,
            timeZone: 'America/Los_Angeles'
          }
        },
        attendees: [
          {email: 'bjeng3@gmail.com',
            displayName: 'Brandon',
            additionalGuests: 10},
        ]
      }, function(err, res) {
        if(err) {
          console.log('Error making reminder',err)
        } else {
          console.log('Success making reminder!')
          console.log(res);
        }
      })
    }

//MEETINGS
function proposeTimes(events, startDate, endDate, duration) {
  var availableTimes = [];
    if (duration.unit === 'min') {
      if(events.length === 1) {
        var slot = {startTime: events.end.dateTime, endTime: events.end.dateTime.add(duration.amount).minutes()}
        availableTimes.push(slot)
        for(let i = 1; i < 4; i++) {
          let newSlot = {startTime: availableTimes[i - 1].endTime, endTime: availableTimes[i - 1].endTime.add(duration.amount).minutes()};
          availableTimes.push(newSlot);
        }
        return availableTimes;
      }
      if(events.length > 1) {
        var counter = 1;
        for(let i = 0; i < events.length - 1; i++) {
          if(events[i+1].start.dateTime - events[i].end.dateTime >= duration.amount) {
            var slot = {startTime: events[i].end.dateTime, endTime: events[i+1].start.dateTime};
            availableTimes.push(slot);
            counter++;
          }
        }
        if(counter < 5) {
          for(let i = counter; i < 5; i++) {
            if(i === counter) {
              let newSlot = {startTime: events[events.length - 1].end.dateTime, endTime: events[events.length - 1].end.endTime.add(duration.amount).minutes()};
              availableTimes.push(newSlot);
            } else {
              let newSlot = {startTime: availableTimes[availableTimes.length - 1].endTime, endTime: availableTimes[availableTimes.length - 1].endTime.add(duration.amount).minutes()};
              availableTimes.push(newSlot);
            }
          }
        }
        return availableTimes;
      }
    }
    else {
      if(events.length === 1) {
        var slot = {startTime: events.end.dateTime, endTime: events.end.dateTime.add(duration.amount).hours()}
        availableTimes.push(slot)
        for(let i = 1; i < 4; i++) {
          let newSlot = {startTime: availableTimes[i - 1].endTime, endTime: availableTimes[i - 1].endTime.add(duration.amount).hours()};
          availableTimes.push(newSlot);
        }
        return availableTimes;
      }
      if(events.length > 1) {
        var counter = 1;
        for(let i = 0; i < events.length - 1; i++) {
          if(events[i+1].start.dateTime - events[i].end.dateTime >= duration.amount) {
            var slot = {startTime: events[i].end.dateTime, endTime: events[i+1].start.dateTime};
            availableTimes.push(slot);
            counter++;
          }
        }
        if(counter < 5) {
          for(let i = counter; i < 5; i++) {
            if(i === counter) {
              let newSlot = {startTime: events[events.length - 1].end.dateTime, endTime: (new Date(events[events.length - 1].end.dateTime)).add(duration.amount).hours()};
              availableTimes.push(newSlot);
            } else {
              let newSlot = {startTime: availableTimes[availableTimes.length - 1].endTime, endTime: (new Date(availableTimes[availableTimes.length - 1].endTime)).add(duration.amount).hours()};
              availableTimes.push(newSlot);
            }
          }
        }
        console.log(availableTimes);
        return availableTimes;
      }
    }
  }


function makeNewMeeting(title, startDate, endDate, newToken, attendees) {
  var attendeesArray = attendees.forEach(function(email) {
    return {email: email};
  })
  var event = {
    summary: title,
    start: {
      dateTime: startDate,
      timeZone: 'America/Los_Angeles',
    },
    end: {
      dateTime: endDate,
      timeZone: 'America/Los_Angeles'
    },
    attendees: attendeesArray,
    }
  calendar.events.insert({
        auth: newToken,
        calendarId: 'primary',
        sendNotifications: true,
        resource: event,
        }, function(err, res) {
        if(err) {
          console.log('Error making a meeting',err)
        } else {
          console.log('Success making meeting!')
          console.log(res);
        }
    });
}

function listEvents(newToken, startDate, endDate, duration, attendees, title) {
  calendar.events.list({
    auth: newToken,
    calendarId: 'primary',
    timeMin: (new Date(startDate)).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
      makeNewMeeting(title, startdate, endDate, newToken, attendees)
    } else {
      console.log('Upcoming 10 events:');
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);
      }
      makeNewMeeting(title, startDate, endDate, newToken, attendees)
      // proposeTimes(events, startDate, endDate, duration)
    }
  });
}

function makeMeeting(token, title, startDate, duration, attendees) {
  var newToken = new auth.OAuth2(client_id, client_secret, redirect_uri);
  newToken.credentials = token;
  var endDate = '';
    if (duration.unit === 'min') {
      endDate = new Date(startDate.add(duration.amount).minutes());
    }
    else {
      console.log(duration.amount);
      endDate = new Date(startDate.add(duration.amount).hour());
    }
    listEvents(newToken, startDate, endDate, duration, attendees, title);
}

module.exports = {authenticate, oauth2Client, SCOPES, listEvents, makeReminder, makeMeeting, makeNewMeeting}

//TODOS
//1 - make sure that enddate adds amount and unit
//2 - fork between propose and make new meeting works
//3 - make sure that propose new times provides next best 10 times

// var readline = require('readline');
// var fs = require('fs');
// var google = require('googleapis');
// var googleAuth = require('google-auth-library');
// var calendar = google.calendar('v3');
// var User = require('../models');
// //MAKE SURE TO REQURE THE BOT HERE
//
// var SCOPES = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar';
// var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
//     process.env.USERPROFILE) + '/.credentials/';
// var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';
// var OAuth2Client = google.OAuth2Client;
// var client_id = process.env.client_id;
// var client_secret = process.env.client_secret;
// var redirect_uri = process.env.redirect_uri;
// var auth = new googleAuth();
// var oauth2Client = new auth.OAuth2(client_id, client_secret, redirect_uri);
//
// function authenticate(code, oauth2Client, id) {
//   oauth2Client.getToken(code, function(err, token) {
//     if (err) {
//       console.log('Error while trying to retrieve access token', err);
//       return;
//     }
//     oauth2Client.credentials = token;
//     User.findOneAndUpdate({userId: id}, {token: token}, function(err) {
//       if (err) {
//         console.log('Did not update', err);
//       } else {
//         console.log('Successfully updated');
//       }
//     });
//   });
// }
//
// //GOOGLE CALENDAR FUNCTIONS
// function listEvents(auth) {
//   calendar.events.list({
//     auth: auth,
//     calendarId: 'primary',
//     timeMin: (new Date()).toISOString(),
//     maxResults: 10,
//     singleEvents: true,
//     orderBy: 'startTime'
//   }, function(err, response) {
//     if (err) {
//       console.log('The API returned an error: ' + err);
//       return;
//     }
//     var events = response.items;
//     if (events.length == 0) {
//       console.log('No upcoming events found.');
//     } else {
//       console.log('Upcoming 10 events:');
//       for (var i = 0; i < events.length; i++) {
//         var event = events[i];
//         var start = event.start.dateTime || event.start.date;
//         console.log('%s - %s', start, event.summary);
//       }
//     }
//   });
// }
//
// function makeReminder(token, title, date) {
//   // console.log('THIS IS THE MASTER AUTH',token)
//   var newToken = new auth.OAuth2(client_id, client_secret, redirect_uri)
//   newToken.credentials = token
//   calendar.events.insert({
//         auth: newToken,
//         calendarId: 'primary',
//         resource: {
//           summary: title,
//           start: {
//             date: date ,
//             timeZone: 'America/Los_Angeles',
//           },
//           end: {
//             date: date,
//             timeZone: 'America/Los_Angeles'
//           }
//         }
//       }, function(err, res) {
//         if(err) {
//           console.log('Error making reminder',err)
//         } else {
//           console.log('Success making reminder!')
//           // console.log(res);
//         }
//       })
//     }

// module.exports = {authenticate, oauth2Client, SCOPES, listEvents, makeReminder}
