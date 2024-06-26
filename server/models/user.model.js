import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  photo: {
    data: Buffer, // Image file will be stored as binary data
    contentType: String
  },
  email: {
    type: String,
    trim: true,
    unique: 'Email already exists',
    match: [/.+\@.+\..+/, 'Please fill a valid email address'],
    required: [true, 'Email is required']
  },
  name: {
    type: String,
    trim: true,
    required: 'Name is required',
    maxlength: [10, 'Name length cannot exceed 50']
  },
  about: {
    type: String,
    trim: true
  },
  created: {
    type: Date,
    default: Date.now()
  },
  updated: Date,
  hashed_password: {
    type: String,
    required: [true, 'Password is required']
  },
  following: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }]
});

// Virtual fields are not saved into the db
// At this moment, virtual async is not supported and the hashing in bcrypt is async
// To re-create a virtual async, this method is used: https://github.com/Automattic/mongoose/issues/5762#issuecomment-339965468
UserSchema
.virtual('password')
.get(function () {
  return this._password;
})
.set(function (password) {
  this._password = password;
  this.hashed_password = password;
});

// This is run before save
// Hashes password after validation before saving
UserSchema.pre('save', function preValidate(next) {
  if (this._password) {
    return this.encryptPassword(this._password).then(() => {
      next();
    });
  }
  next();
});

// Password field validation
/*
    To validate the path 'hashed_password'.
    Validation occurs when Mongoose attempts to store the hashed password value.

    this.invalidate gives an error message which states the reason path 'password' was invalid.

    this.isNew is a property available in Mongoose that states if the document is newly created.
*/
UserSchema.path('hashed_password').validate(function () {
  if (this._password && this._password.length < 6) {
    this.invalidate('password', 'Password must be at least 6 characters');
  }
  if (this.isNew && !this._password) {
    this.invalidate('password', 'Password is required');
  }
}, null);

// Add model business logic
/*
    authenticate: To verify sign-in attempts by matching the user-provided password text with the hashed_password stored in db
    encryptPassword: To generate a hash with 10 salt rounds of bcrypt
*/
UserSchema.methods = {
  authenticate: async function (plainText) {
    const isMatch = await new Promise(resolve => {
      bcrypt.compare(plainText, this.hashed_password, (err, isMatch) => {
        if (err) console.log(`Error in aunthenticating password: ${err}`);
        resolve(isMatch);
      });
    });
    return isMatch;
  },
  encryptPassword: async function (plainPassword) {
    try {
      this.hashed_password = await new Promise(resolve => {
        bcrypt.genSalt(10, (err, salt) => {
          if (err) console.log(`Error in creating bcrypt salt: ${err}`);
          bcrypt.hash(plainPassword, salt, (err, hash) => {
            if (err) console.log(`Error in hashing password: ${err}`);
            resolve(hash);
          })
        })
      });
      this._password = '';
    } catch (err) {
      console.log(`Error in encrypting password: ${err}`);
    }
  }
}

export default mongoose.model('User', UserSchema);
