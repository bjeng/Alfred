"use strict";

var { WebClient, RtmClient, RTM_EVENTS } = require('@slack/client');
var dialogflow = require('./dialogflow');
var google = require('./google')
var token = process.env.BOT_TOKEN || '';
var User = require('../models');
var userToken = process.env.BOT_TOKEN;
var slack = require('slack');
var dateJs = require('datejs');

var rtm = new RtmClient(token);
var web = new WebClient(token);
rtm.start();

function getInteractiveMessage(message, proposed) {
  return {
    "text": message,
    // "fields": [
    //   {
    //     "title": ,
    //     "value": ,
    //     "short": true
    //   }
    // ]
    "attachments": [
      {
        "fallback": "you are unable to create a reminder",
        "callback_id": "reminder",
        "attachment_type": "default",
        "actions": [
          {
            "name": "1",
            "text": "1",
            "type": "button",
            "style": "primary",
            "value": proposed[0].startTime
          },
          {
            "name": "confirm2",
            "text": "2",
            "type": "button",
            "style": "primary",
            "value": proposed[1].startTime
          },
          {
            "name": "confirm3",
            "text": "3",
            "type": "button",
            "style": "primary",
            "value": proposed[2].startTime
          },
          {
            "name": "confirm4",
            "text": "4",
            "type": "button",
            "style": "primary",
            "value": proposed[3].startTime
          },
          {
            "name": "5",
            "text": "5",
            "type": "button",
            "style": "primary",
            "value": proposed[4].startTime
          },
        ]
      }
    ]
  };
}

function handleDialogflowConvo(message) {
  dialogflow.interpretUserMessage(message.text, message.user)
  .then(function(res) {
    var { data } = res;

    var title = data.result.parameters['meeting-name']
    var dateTime = new Date(data.result.parameters.dateTime)
    var duration = data.result.parameters.duration
    var token = {};
    var attendees = [];
    if (data.result.metadata.intentName === 'meeting.add') {
      if (data.result.actionIncomplete) {
        web.chat.postMessage(message.channel, data.result.fulfillment.speech);
      } else {
          slack.users.list({token: userToken})
            .then(resp => {
            var emails = data.result.parameters.emails.filter(function(item, pos) {
              return data.result.parameters.emails.indexOf(item) == pos})
              attendees = emails
            })
            .then(emails => {
              return User.findOne({userId: message.user}, function(err,user) {
                if(err) {
                  console.log('Error finding user in MONGO', err)
                } else {
                  token = user.token;
                  return user;
                }
              })
            })
            .then(user => {
              return User.findOneAndUpdate({userId: user.userId}, {title: title, duration: duration, attendees: attendees}, function(err) {
                if(err) {
                  console.log('There was an error updating user with meeting information', err);
                  throw Error;
                } else {
                  console.log('Updated user with meeting information!')
                }
              })
            })
            .then(() => {
              return google.conflictCheck(dateTime, token, duration);
            })
            .then(events => {
              if(events === 'No Conflict') {
                return google.makeNewMeeting(title, dateTime, token, duration, attendees);
                web.chat.postMessage(message.channel, data.result.fulfillment.speech);
              } else {
                return google.proposeTimes(events, dateTime, token, duration)
              }
            })
            .then(proposed => {
              if(proposed[0].startTime) {
                var list = proposed.map((slot, index) => {
                  var start = slot.startTime.toString();
                  var end = slot.endTime.toString();
                  var str = `${index + 1} - ${start} to ${end} \n`
                  return str;
                  // return str.link(`http://localhost:3000/makemeeting?title=${title}&dateTime=${start}&token=${token}&duration=${duration}&attendees=${attendees}`)
                })
                web.chat.postMessage(message.channel, `Sir, it seems the slot you have requested is taken. Please choose from the following options:
${list.join('')}`, getInteractiveMessage(list, proposed));
              }
            })
          .catch(e =>
            console.log('Error handling meeting message', e))
        }
    } else if (data.result.metadata.intentName === 'reminder.add') {
        if (data.result.actionIncomplete) {
          web.chat.postMessage(message.channel, data.result.fulfillment.speech);
        } else {
            var title = data.result.parameters['reminder-name']
            var date = data.result.parameters.date
            var token = user.token
            if (data.result.parameters.confirm === "Confirm") {
              google.makeReminder(token, title, date)
              web.chat.postMessage(message.channel, data.result.fulfillment.speech);
            }
          }
      } else if (data.result.metadata.intentName === 'signup')  {
        if(data.result.actionIncomplete) {
          web.chat.postMessage(message.channel, data.result.fulfillment.speech);
        } else {
          User.findOne({userId: message.user}, function(err,user) {
            if(err) {
              console.log('Error finding user in MONGO', err)
            } else {
              if(user.token) {
                web.chat.postMessage(message.channel, `My apologies sir. It seems like you are already signed in on google Calendar, but if you need to re-validate your credentials please see link http://localhost:3000/setup?slackId=${message.user}.`)
              } else {
                web.chat.postMessage(message.channel, `Much appreciated sir. Please see the link below to connect. Let me know if there's anything I can do for you.
                http://localhost:3000/setup?slackId=${message.user}`)
              }
            }
          });
        }
      } else {
          web.chat.postMessage(message.channel, `Let me know if there's anything I can do for you sir.`)
      }
    })
  .catch(function(err) {
    console.log('Error sending message to Dialogflow', err);
  });
}

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  if (! message.user) {
    console.log('Message send by a bot, ignoring');
    return;
  } else {
    User.findOne({userId: message.user}, function(err, user) {
      if (!user) {
        console.log('DID NOT FIND PERSON IN MONGO', err);
        var newUser = new User ({
          userId: message.user,
          token: {}
        })
        newUser.save(function(err) {
          if(err) {
            console.log("User was not saved", err);
          } else {
            console.log('User was saved');
          }
        })
      }
    })
    handleDialogflowConvo(message);
  }
});

// final reminder: Your reminder: {action} has been scheduled for {date}
// final meeting: Your meeting: {action} has been scheduled for {date} at {time} with {name}
