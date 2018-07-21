var readline = require('readline');
var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var dateJs = require('datejs');
var calendar = google.calendar('v3');
var User = require('../models');
//MAKE SURE TO REQURE THE BOT HERE

var SCOPES = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar';
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
      oauth2Client.credentials = token;
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
  function proposeTimes(events, startDate, token, duration) {
    var availableTimes = [];
    var unit = duration.unit;
    var endDate = '';
    if (duration.unit === 'min') {
      endDate = new Date(startDate).add(duration.amount).minutes();
    }
    else {
      endDate = new Date(startDate).add(duration.amount).hours();
    }
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
          return availableTimes;
        }
      }
      console.log(availableTimes);
      return availableTimes;
  }

  function makeNewMeeting(title, startDate, token, duration, attendees) {
    var newToken = new auth.OAuth2(client_id, client_secret, redirect_uri);
    newToken.credentials = token;
    var endDate = '';
    if (duration.unit === 'min') {
      endDate = new Date(startDate).add(duration.amount).minutes();
    }
    else {
      endDate = new Date(startDate).add(duration.amount).hours();
    }
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
          console.log('New meeting created', res);
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
      if((e1StartCompare === 1 && (e1EndCompare === -1 || e1EndCompare ===0)) || ((e2StartCompare === 1 || e2StartCompare === 0) && e2EndCompare === -1)) {
        conflict = 'Conflict';
        break;
      }
    }
    console.log('There are conflicts ', conflict);
    return conflict;
  }

  function conflictCheck(startDate, token, duration) {
    var newToken = new auth.OAuth2(client_id, client_secret, redirect_uri);
    newToken.credentials = token;
    var endDate = '';
    if (duration.unit === 'min') {
      endDate = new Date(startDate).add(duration.amount).minutes();
    }
    else {
      endDate = new Date(startDate).add(duration.amount).hours();
    }
      return new Promise(function(resolve, reject) {
        return calendar.events.list({
          auth: newToken,
          calendarId: 'primary',
          timeMin: new Date(startDate).toISOString(),
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
        return events;
      })
      .then(function(events) {
        console.log('Five')
        if (compareDates(startDate, endDate, duration, events) === 'Conflict') {
          return events;
        } else {
          console.log('No upcoming events found.');
          return 'No Conflict';
        }
      })
      .catch(function(err) {
        console.log('Error in the conflicts check function', err);
      })
  }

  module.exports = {authenticate, oauth2Client, SCOPES, makeReminder, makeNewMeeting, compareDates, proposeTimes, conflictCheck}