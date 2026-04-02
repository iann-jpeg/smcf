require('dotenv').config();
const mongoose = require('mongoose');
const Cycle = require('./models/Cycle.js');
const Member = require('./models/Member.js');
(async() => {
 try {
   const uri = process.env.MONGODB_URI || 'mongodb+srv://valinyala24472:Abungana123@cluster0.rtgyu8k.mongodb.net/smcf?retryWrites=true&w=majority';
   await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
   const c16 = await Cycle.findOne({cycle_number:16}).populate('next_recipient', 'name member_id position');
   const c17 = await Cycle.findOne({cycle_number:17}).populate('next_recipient', 'name member_id position');
   console.log('c16', c16 && {
     cycle_number:c16.cycle_number,
     status:c16.status,
     next_recipient:c16.next_recipient && {name:c16.next_recipient.name, member_id:c16.next_recipient.member_id, position:c16.next_recipient.position, _id:c16.next_recipient._id},
     recipient_id:c16.recipient_id ? c16.recipient_id.toString() : null
   });
   console.log('c17', c17 && {
     cycle_number:c17.cycle_number,
     status:c17.status,
     next_recipient:c17.next_recipient && {name:c17.next_recipient.name, member_id:c17.next_recipient.member_id, position:c17.next_recipient.position, _id:c17.next_recipient._id},
     recipient_id:c17.recipient_id ? c17.recipient_id.toString() : null
   });
   if (c16 && c16.next_recipient && c16.next_recipient.position != null) {
     const next = await Member.findOne({position: {$gt: c16.next_recipient.position}, status:'active'}).sort({position:1});
     console.log('next after c16.next_recipient', next && {name: next.name, member_id: next.member_id, position: next.position, _id: next._id});
   }
   if (c17 && c17.next_recipient && c17.next_recipient.position != null) {
     const next2 = await Member.findOne({position: {$gt: c17.next_recipient.position}, status:'active'}).sort({position:1});
     console.log('next after c17.next_recipient', next2 && {name: next2.name, member_id: next2.member_id, position: next2.position, _id: next2._id});
   }
   const m16 = await Member.findOne({position:16});
   console.log('member pos16', m16 && {name:m16.name, member_id:m16.member_id, position:m16.position, _id:m16._id});
   const m17 = await Member.findOne({position:17});
   console.log('member pos17', m17 && {name:m17.name, member_id:m17.member_id, position:m17.position, _id:m17._id});
 } catch(err) {
   console.error('error', err);
 } finally {
   await mongoose.disconnect();
 }
})();
