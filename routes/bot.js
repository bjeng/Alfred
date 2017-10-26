"use strict";

var { WebClient, RtmClient, RTM_EVENTS } = require('@slack/client');
var dialogflow = require('./dialogflow');
var google = require('./google')
var token = process.env.BOT_TOKEN || '';
var User = require('../models');
var userToken = process.env.BOT_TOKEN;
var slack = require('slack');

var rtm = new RtmClient(token);
var web = new WebClient(token);
rtm.start();

function handleDialogflowConvo(message) {
  dialogflow.interpretUserMessage(message.text, message.user)
  .then(function(res) {
    var { data } = res;
    // console.log('OBJECT', data.result.parameters.invitees);
    if (data.result.metadata.intentName === 'meeting.add'){
        // web.chat.postMessage(message.channel, data.result.fulfillment.speech);
        if (data.result.parameters.emails.length > 0){
            slack.users.list({token: userToken})
            .then(resp => {
            // var id = '';
            // var text = 'text to send when user found';
            // for (var i = 0; i < resp.members.length; i++){
            //     if (resp.members[i].indexOf(data.result.parameters.invitees) > -1){
            //         id = resp.members[i].id
            //     }
            // }
            // slack.chat.postMessage({token: userToken,  channel: id, text:text})
            var emails = data.result.parameters.emails.filter(function(item, pos) {
              return data.result.parameters.emails.indexOf(item) == pos;
            });
            console.log(emails);
            User.findOne({userId: message.user}, function(err,user) {
              if(err) {
                console.log('Error finding user in MONGO', err)
              } else {
                var title = data.result.parameters['meeting-name']
                var dateTime = new Date(data.result.parameters.dateTime)
                console.log(dateTime)
                var token = user.token
                var duration = data.result.parameters.duration
                // google.makeMeeting(token, title, dateTime, duration, emails);
                google.makeMeeting(token, title, dateTime, duration, emails)
              }
            })
            // console.log(data.result.parameters.emails);
            // console.log(resp.members[i].profile.email)
        }).catch(e => console.log(e))
        }
    } else {
      if (data.result.metadata.intentName === 'reminder.add'){
        if (data.result.actionIncomplete) {
          // console.log(data.result.fulfillment.speech)
          web.chat.postMessage(message.channel, data.result.fulfillment.speech);
        } else {
          web.chat.postMessage(message.channel,
            `You asked me to remind you to ${data.result.parameters['reminder-name'][0]} on ${data.result.parameters.date}`);
            User.findOne({userId: message.user}, function(err,user) {
              if(err) {
                console.log('Error finding user in MONGO', err)
              } else {
                var title = data.result.parameters['reminder-name'][0]
                var date = data.result.parameters.date
                var token = user.token
                google.makeReminder(token, title, date)
              }
            })
        }
      }
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
    User.findOne({userId: message.user}, function(err, user){
      if (!user){
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
        web.chat.postMessage(message.channel, `Do you want to connect to google calendar?
        http://localhost:3000/setup?slackId=${message.user}`)
      }
    })
    handleDialogflowConvo(message);
  }
});

// final reminder: Your reminder: {action} has been scheduled for {date}
// final meeting: Your meeting: {action} has been scheduled for {date} at {time} with {name}
