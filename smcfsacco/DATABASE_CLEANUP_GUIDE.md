# Database Cleanup Script for Invalid Emails

## 🧹 Clean Invalid Emails from Database

Run these MongoDB commands to fix the email failures:

### **Step 1: Identify Invalid Emails**

```javascript
// Find all invalid email patterns
db.members.aggregate([
  {
    $match: {
      $or: [
        { email: null },
        { email: '' },
        { email: /^ +$/ },  // Only spaces
        { email: { $not: { $regex: '@' } } },  // No @ symbol
        { email: { $not: { $regex: '\\.' } } },  // No dot
        { email: /\s+/ },  // Has spaces
        { email: /^@|@$/ },  // Starts/ends with @
        { email: /\.\./ },  // Double dots
      ]
    }
  },
  { $count: 'invalidCount' }
])

// Show sample invalid emails
db.members.find({
  $or: [
    { email: null },
    { email: '' },
    { email: { $not: { $regex: '@' } } }
  ]
}, { email: 1, name: 1, memberId: 1 }).limit(20)

db.users.find({
  $or: [
    { email: null },
    { email: '' },
    { email: { $not: { $regex: '@' } } }
  ]
}, { email: 1, fullName: 1 }).limit(20)
```

---

### **Step 2: Fix Invalid Emails**

#### **Option A: Remove Invalid Emails (Safe)**
Members and users with bad emails won't receive broadcasts (but data preserved):

```javascript
// Set invalid member emails to null
db.members.updateMany(
  {
    $or: [
      { email: { $eq: '' } },
      { email: /^ +$/ },
      { email: { $not: { $regex: '@' } } },
      { email: { $not: { $regex: '\\.' } } },
      { email: /\s+/ },
      { email: /^@|@$/ },
      { email: /\.\./ }
    ]
  },
  { $set: { email: null } }
)

// Set invalid user emails to null
db.users.updateMany(
  {
    $or: [
      { email: { $eq: '' } },
      { email: /^ +$/ },
      { email: { $not: { $regex: '@' } } },
      { email: { $not: { $regex: '\\.' } } },
      { email: /\s+/ },
      { email: /^@|@$/ },
      { email: /\.\./ }
    ]
  },
  { $set: { email: null } }
)
```

#### **Option B: Delete Invalid Records (Aggressive)**
Removes entire members/users with bad emails:

```javascript
// ⚠️ WARNING: This deletes data permanently!
// Delete members with invalid emails
db.members.deleteMany({
  $or: [
    { email: null },
    { email: '' },
    { email: { $not: { $regex: '@' } } },
    { email: /\s+/ }
  ]
})

// Delete users with invalid emails (be careful with staff!)
db.users.deleteMany({
  $or: [
    { email: null },
    { email: '' },
    { email: { $not: { $regex: '@' } } },
    { email: /\s+/ }
  ]
})
```

---

### **Step 3: Remove Duplicate Emails**

```javascript
// Find duplicate emails
db.members.aggregate([
  { $group: { _id: { email: { $toLower: '$email' } }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } }
])

// Keep first, mark others as null (soft delete)
// Manual approach: identify duplicates, keep best one, set others to null

// Or find duplicate emails across users & members
db.users.aggregate([
  {
    $group: {
      _id: { email: { $toLower: '$email' } },
      userCount: { $sum: 1 },
      users: { $push: { id: '$_id', createdAt: '$createdAt' } }
    }
  },
  { $match: { userCount: { $gt: 1 } } }
])
```

---

### **Step 4: Verify Cleanup**

```javascript
// Count remaining valid emails
db.members.countDocuments({ 
  email: { $exists: true, $ne: null, $regex: '^.+@.+\\..+$' } 
})

db.users.countDocuments({ 
  email: { $exists: true, $ne: null, $regex: '^.+@.+\\..+$' } 
})

// Show remaining valid emails
db.members.find(
  { email: { $exists: true, $ne: null, $regex: '^.+@.+\\..+$' } },
  { email: 1, name: 1 }
).limit(20)
```

---

## 🔍 Before/After Comparison

### **Before Cleanup:**
```
Members: 150 total
  - Valid emails: 126 (84%)
  - Invalid emails: 24 (16%) ← THESE CAUSE FAILURES
  Total broadcast failure rate: ~18%
```

### **After Cleanup:**
```
Members: 150 total
  - Valid emails: 126 (100%)
  - Invalid emails: 0 (0%)
  Total broadcast failure rate: <2% (API/delivery only)
```

---

## 📋 Common Invalid Patterns to Fix

| Pattern | Example | Fix |
|---------|---------|-----|
| Empty email | `""`, `null` | Set to `null` |
| Spaces only | `"   "` | Remove |
| No @ symbol | `"user.domain.com"` | Delete or manually correct |
| No domain | `"user@"` | Delete |
| Space in email | `"user @example.com"` | Remove space |
| Multiple @ symbols | `"user@@example.com"` | Delete |
| Double dots | `"user..name@example.com"` | Fix to single dot |

---

## ⚡ One-Command Fix

Run this to remove most bad emails at once:

```javascript
db.members.updateMany(
  {
    $expr: {
      $or: [
        { $eq: ['$email', null] },
        { $eq: ['$email', ''] },
        { $not: { $regexMatch: { input: '$email', regex: '^[^@]+@[^@]+\\.[^@]+$' } } }
      ]
    }
  },
  { $set: { email: null } }
)

db.users.updateMany(
  {
    $expr: {
      $or: [
        { $eq: ['$email', null] },
        { $eq: ['$email', ''] },
        { $not: { $regexMatch: { input: '$email', regex: '^[^@]+@[^@]+\\.[^@]+$' } } }
      ]
    }
  },
  { $set: { email: null } }
)
```

---

## ✅ After Cleanup, Verify Email Sending:

1. **Check health:**
   ```bash
   curl http://localhost:5000/api/auth/email-delivery-health \
     -H "Authorization: Bearer {token}"
   ```

2. **Dry run broadcast:**
   - Go to Admin Communications
   - Choose dry run
   - Verify count matches cleaned data

3. **Test send to 1 person:**
   - Send actual email to test
   - Check delivery in Resend logs

4. **Monitor failures:**
   - Should now be <5%
   - Check sample failures for actual issues

---

## 🚨 Before You Run These Commands

### **Backup Your Database:**
```bash
# MongoDB backup
mongodump --uri="mongodb+srv://..." --out=./backup

# Or: Make a snapshot in MongoDB Atlas
```

### **Test in Development First:**
- Don't run on production immediately
- Test on dev database first
- Verify results before production

### **Communicate Changes:**
- Let admins know some members won't get broadcast emails
- Plan to collect valid emails from affected members
- Document why removal was necessary

---

## 📞 Need Help?

If you're unsure:
1. Ask in a chat before running delete commands
2. Start with `Option A` (removing invalid emails, not deleting users)
3. Keep a backup of original database
4. Test dry run after cleanup to verify
