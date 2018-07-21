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

  var allTimes = [];

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
      oauth2Client.credentials = token;
      var newToken = oauth2Client;
      var title = 'Eating';
      var startDate = new Date();
      var duration = {unit: 'hour', amount: 2};
      var attendees = ['hsaab310@gmail.com', 'bjeng3@gmail.com'];
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
    var unit = duration.unit;
    for(let i = 0; i < events.length - 1; i++) {
      if(availableTimes.length === 5) {
        break;
      }
      var event1End = new Date(events[i].end.dateTime);
      var event2Start = new Date(events[i + 1].start.dateTime);
      var timeAvailable = 0;
      if(unit === 'min') {
        timeAvailable = (event2Start - event1End)/1000/60/60;
      } else {
        timeAvailable = (event2Start - event1End)/1000/60;
      }
      if(timeAvailable >= duration.amount) {
        var slots = Math.round(timeAvailable / duration.amount);
        var amount = duration.amount;
        for(let z = 0; z < slots; z++) {
          if(availableTimes.length === 5) {
            break;
          }
          if(unit === 'min') {
            var slot = {startTime: new Date(event1End).add(z*amount).minutes().toString(), endTime: new Date(event1End).add((z+1)*amount).minutes().toString()}
            availableTimes.push(slot);
          } else {
            var slot = {startTime: new Date(event1End).add(z*amount).hours().toString(), endTime: new Date(event1End).add((z+1)*amount).hours().toString()}
            availableTimes.push(slot);
          }
        }
        console.log(availableTimes);
        allTimes = availableTimes;
        return availableTimes;
      }
    }
    console.log(availableTimes);
    return availableTimes;
  }

  function makeNewMeeting(title, startDate, endDate, newToken, attendees) {
    return new Promise(function(resolve,reject) {
      function makeEmails(attendees) {
        return attendees.map(email => {
          return {
            email: email,
          };
        });
      }
      if(makeEmails(attendees)) {
        resolve(makeEmails(attendees));
      } else {
        reject();
      }
    })
    .then(function(attendees) {
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
        attendees: attendees,
      }
      return event
    })
    .then(function(event) {
      return calendar.events.insert({
        auth: newToken,
        calendarId: 'primary',
        sendNotifications: true,
        resource: event,
      }, function(err, res) {
        if(err) {
          console.log('Error making a meeting',err)
        } else {
          console.log('Success making meeting!')
          // console.log(res);
        }
      });
    })
    .catch(function(err) {
      console.log('Error making new event!', err)
    });
  }

  function compareDates (startDate, endDate, duration, events) {
    var conflict = 'None';
    for(let i = 0; i < events.length - 1; i++) {
      var e1StartCompare = Date.compare(new Date(events[i].end.dateTime), new Date(startDate));
      var e1EndCompare = Date.compare(new Date(events[i].end.dateTime), new Date(endDate));
      var e2StartCompare = Date.compare(new Date(events[i + 1].start.dateTime), new Date(startDate));
      var e2EndCompare = Date.compare(new Date(events[i + 1].start.dateTime), new Date(endDate));
      // console.log(e1StartCompare, e1EndCompare, e2StartCompare, e2EndCompare)
      if((e1StartCompare === 1 && e1EndCompare === -1 || 0) || (e2StartCompare === 1 || 0 && e2EndCompare === -1)) {
        conflict = 'Conflict';
        break;
      }
    }
    return conflict;
  }

  function listEvents(newToken, startDate, endDate, duration, attendees, title) {
    console.log('Three')
    return new Promise(function(resolve, reject) {
      return calendar.events.list({
        auth: newToken,
        calendarId: 'primary',
        timeMin: (new Date(startDate)).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      }, function(err,res) {
        if(err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
    .then(function(response) {
      console.log('Four')
      var events = response.items;
      return events
    })
    .then(function(events) {
      console.log('Five')

      if (compareDates(startDate, endDate, duration, events) === 'Conflict') {
        //  console.log('Upcoming 10 events:');
        for (var i = 0; i < events.length; i++) {
          var event = events[i];
          var start = event.start.dateTime || event.start.date;
          //  console.log('%s - %s', start, event.summary);
        }
        return proposeTimes(events, startDate, endDate, duration);
      } else {
        console.log('No upcoming events found.');
        return makeNewMeeting(title, startDate, endDate, newToken, attendees);
      }

      // return new Promise(function(resolve, reject) {
      //   console.log('Six')
      //   if(compareDates(startDate, endDate, duration, events)) {
      //     resolve(compareDates(startDate, endDate, duration, events))
      //   } else {
      //     reject()
      //   }
      // })
      // .then(function(conflict) {
      //   //  console.log('THIS IS THE CONFLICT', conflict)
      //   if (conflict === 'Conflict') {
      //     //  console.log('Upcoming 10 events:');
      //     for (var i = 0; i < events.length; i++) {
      //       var event = events[i];
      //       var start = event.start.dateTime || event.start.date;
      //       //  console.log('%s - %s', start, event.summary);
      //     }
      //     proposeTimes(events, startDate, endDate, duration);
      //   } else {
      //     console.log('No upcoming events found.');
      //     makeNewMeeting(title, startDate, endDate, newToken, attendees);
      //   }
      // })
    })
    .catch(function(err) {
      console.log('Error in the listEvents function', err);
    })
  }

  function makeMeeting(token, title, startDate, duration, attendees) {
    console.log('One')
    var newToken = new auth.OAuth2(client_id, client_secret, redirect_uri);
    newToken.credentials = token;
    var endDate = '';
    if (duration.unit === 'min') {
      endDate = new Date(startDate).add(duration.amount).minutes();
    }
    else {
      endDate = new Date(startDate).add(duration.amount).hours();
    }
    console.log('Two')
    return listEvents(newToken, startDate, endDate, duration, attendees, title)
    // .then((resp) => {
    //   allTimes = resp;
    // });
  }

  module.exports = {authenticate, oauth2Client, SCOPES, listEvents, makeReminder, makeMeeting, makeNewMeeting, allTimes}
