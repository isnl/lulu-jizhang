const mongoose = require('mongoose');
const config = require('./config');

const recordSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: config.recordTypes
  },
  category: {
    type: String,
    required: true,
    enum: config.categories
  },
  amount: {
    type: Number,
    required: true,
    min: config.validation.amount.min,
    max: config.validation.amount.max
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  remark: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Record', recordSchema);
