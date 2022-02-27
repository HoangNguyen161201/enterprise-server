const mongoose = require('mongoose');

//Define schema model
const reactionTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    require: true,
    unique: true,
    
  },
  icon: {
    type: String,
  }
});

module.exports = mongoose.model('reactiontypes', reactionTypeSchema);
