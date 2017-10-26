var mongoose = require('mongoose');
var connect = process.env.mongodb_uri;
var Schema = mongoose.Schema;

// If you're getting an error here, it's probably because
// your connect string is not defined or incorrect.
mongoose.connect(connect);

var userSchema = new Schema({
  userId: String,
  token: Object
});

var User = mongoose.model('User', userSchema);

module.exports = User
